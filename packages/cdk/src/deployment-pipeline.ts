import {CloudFormationCapabilities} from '@aws-cdk/aws-cloudformation';
import {BuildSpec, ComputeType, LinuxBuildImage, PipelineProject} from '@aws-cdk/aws-codebuild';
import {Artifact, Pipeline} from '@aws-cdk/aws-codepipeline';
import {
	CloudFormationCreateUpdateStackAction,
	CloudFormationDeleteStackAction,
	CodeBuildAction,
	GitHubSourceAction,
	ManualApprovalAction
} from '@aws-cdk/aws-codepipeline-actions';
import {AccountPrincipal, AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal} from '@aws-cdk/aws-iam';
import {Key} from '@aws-cdk/aws-kms';
import {Bucket, BucketEncryption} from '@aws-cdk/aws-s3';
import { Construct, RemovalPolicy, SecretValue, Stack, StackProps, Tag} from '@aws-cdk/core';

export interface Props extends StackProps {
	readonly devAccountId: string;
	readonly ciAccountId: string;
	readonly prodAccountId: string;
	readonly deploymentType: 'feature' | 'release';
	readonly serviceCode: string;
	readonly serviceName: string;
	readonly serviceOwner: string;
	readonly sourceBranch: string;
	readonly uniquePrefix: string;
}

export class DeploymentPipeline extends Stack {

	constructor(scope: Construct, id: string, props: Props) {
		super(scope, id, props);

		const STACK = Stack.of(this);

		const PREFIX = `${props.uniquePrefix}-${props.deploymentType}-${STACK.region}`; // TODO: This doesn't work for the stack names...

		Tag.add(this, 'Deployment', `${props.deploymentType}`);
		Tag.add(this, 'ServiceCode', `${props.serviceCode}`);
		Tag.add(this, 'ServiceName', `${props.serviceName}`);
		Tag.add(this, 'ServiceOwner', `${props.serviceOwner}`);

		// Use existing PARs without attaching additional policy
		const devPipelineAutomationRole = Role.fromRoleArn(this, 'DevPipelineAutomationRole', `arn:aws:iam::${props.devAccountId}:role/PipelineAutomationRole`, { mutable: false });
		const ciPipelineAutomationRole = Role.fromRoleArn(this, 'CIPipelineAutomationRole', `arn:aws:iam::${props.ciAccountId}:role/PipelineAutomationRole`, { mutable: false });
		const prodPipelineAutomationRole = Role.fromRoleArn(this, 'ProdPipelineAutomationRole', `arn:aws:iam::${props.prodAccountId}:role/PipelineAutomationRole`, { mutable: false });
		const mgmtPipelineAutomationRole = Role.fromRoleArn(this, 'MgmtPipelineAutomationRole', `arn:aws:iam::${STACK.account}:role/PipelineAutomationRole`, { mutable: false });

		const oauthToken = SecretValue.secretsManager('GitHubToken');
		const infrastructureSourceOutput = new Artifact('SourceOutput');

		const encryptionKey = new Key(this, 'FeatureKMSKey', {
			alias: `alias/${props.uniquePrefix}/${STACK.region}/${props.deploymentType}/key`,
			description: `KMS key for the ${props.deploymentType} pipeline for ${PREFIX} stack`,
			enableKeyRotation: false,
			removalPolicy: RemovalPolicy.DESTROY
		});

		const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: `${PREFIX}-artifact-bucket`,
			encryption: BucketEncryption.KMS,
			encryptionKey,
			removalPolicy: RemovalPolicy.DESTROY
		});

		const cdkBuild = new PipelineProject(this, 'CDKBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: [
							'npm install -g cdk',
							'yarn'
						],
					},
					build: {
						commands: [
							'cd $CODEBUILD_SRC_DIR/packages/cdk',
							'cdk synth Client > client.template.yaml',
							'cdk synth APILayer > api.template.yaml',
							'cdk synth Database > database.template.yaml'
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/cdk',
					files: [
						'client.template.yaml',
						'api.template.yaml',
						'database.template.yaml'
					]
				}
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_3_0,
				computeType: ComputeType.MEDIUM
			},
			projectName: `${PREFIX}-cdk-build`,
			role: mgmtPipelineAutomationRole
		});

		const lambdaBuild = new PipelineProject(this, 'LambdaBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: [
							'yarn'
						],
					},
					build: {
						commands: [
							'cd $CODEBUILD_SRC_DIR/packages/lambda',
							'yarn build',
							'cd $CODEBUILD_SRC_DIR',
							'yarn install --production --ignore-scripts --prefer-offline'
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/lambda',
					files: [
						'dist/*',
						'node_modules/*'
					]
				}
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_3_0,
				computeType: ComputeType.MEDIUM
			},
			projectName: `${PREFIX}-lambda-build`,
			role: mgmtPipelineAutomationRole
		});

		const cdkBuildOutput = new Artifact('CDKBuildOutput');
		const lambdaBuildOutput = new Artifact('LambdaBuildOutput');

		const deploymentPipeline = new Pipeline(this, 'DeploymentPipeline', {
			artifactBucket,
			pipelineName: `${PREFIX}-deployment-pipeline`,
			restartExecutionOnUpdate: false,
			role: mgmtPipelineAutomationRole,
			stages: []
		});

		const sourceStage = deploymentPipeline.addStage({
			stageName: 'Source',
			actions: [new GitHubSourceAction({
				actionName: 'Source',
				owner: 'AlexBMet',
				repo: 'AlexBCdkRepo',
				branch: `${props.sourceBranch}`,
				oauthToken,
				output: infrastructureSourceOutput,
			})],
		});

		const buildStage = deploymentPipeline.addStage({
			stageName: 'Build',
			actions: [
				new CodeBuildAction({
					actionName: 'SynthesiseTemplates',
					project: cdkBuild,
					input: infrastructureSourceOutput,
					outputs: [cdkBuildOutput],
					runOrder: 1
				}),
				new CodeBuildAction({
					actionName: 'BuildLambda',
					project: lambdaBuild,
					input: infrastructureSourceOutput,
					outputs: [lambdaBuildOutput],
					runOrder: 2
				})
			],
			placement: {
				justAfter: sourceStage
			}
		});

		const stage1DeployDatabaseAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployDatabase',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'stg' : 'dev',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 2,
			stackName: `${PREFIX}-database`,
			templatePath: cdkBuildOutput.atPath('database.template.yaml')
		});

		const stage2DeployDatabaseAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployDatabase',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'prod' : 'ci',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 2,
			stackName: `${PREFIX}-database`,
			templatePath: cdkBuildOutput.atPath('database.template.yaml')
		});

		const stage1DeployAPILayerAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployAPILayer',
			adminPermissions: false,
			capabilities: [CloudFormationCapabilities.NAMED_IAM],
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			extraInputs: [lambdaBuildOutput],
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'stg' : 'dev',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'SourceBucketName': `${lambdaBuildOutput.bucketName}`,
				'SourceObjectKey': `${lambdaBuildOutput.objectKey}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 3,
			stackName: `${PREFIX}-api-layer`,
			templatePath: cdkBuildOutput.atPath('api.template.yaml')
		});

		const stage2DeployAPILayerAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployAPILayer',
			adminPermissions: false,
			capabilities: [CloudFormationCapabilities.NAMED_IAM],
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			extraInputs: [lambdaBuildOutput],
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'prod' : 'ci',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'SourceBucketName': `${lambdaBuildOutput.bucketName}`,
				'SourceObjectKey': `${lambdaBuildOutput.objectKey}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 3,
			stackName: `${PREFIX}-api-layer`,
			templatePath: cdkBuildOutput.atPath('api.template.yaml')
		});

		const stage1DeployClientAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployClient',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'stg' : 'dev',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 4,
			stackName: `${PREFIX}-client`,
			templatePath: cdkBuildOutput.atPath('client.template.yaml')
		});

		const stage2DeployClientAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployClient',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			parameterOverrides: {
				'Environment': props.deploymentType === 'release' ? 'prod' : 'ci',
				'ServiceCode': `${props.serviceCode}`,
				'ServiceName': `${props.serviceName}`,
				'ServiceOwner': `${props.serviceOwner}`,
				'UniquePrefix': `${props.uniquePrefix}`
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 4,
			stackName: `${PREFIX}-client`,
			templatePath: cdkBuildOutput.atPath('client.template.yaml')
		});

		if (props.deploymentType === 'feature') {
			const deployDevStage = deploymentPipeline.addStage({
				actions: [
					stage1DeployDatabaseAction,
					stage1DeployAPILayerAction,
					stage1DeployClientAction
				],
				placement: {
					justAfter: buildStage
				},
				stageName: 'DeployToDev',
			});

			const deployCIStage = deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the CI environment?',
						runOrder: 1
					}),
					stage2DeployDatabaseAction,
					stage2DeployAPILayerAction,
					stage2DeployClientAction
				],
				placement: {
					justAfter: deployDevStage
				},
				stageName: 'DeployToCI',
			});

			// TODO: Add integration & E2E tests here

			const teardownCIStage = deploymentPipeline.addStage({
				actions: [
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownClient',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 2,
						stackName: `${PREFIX}-client`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownAPILayer',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 3,
						stackName: `${PREFIX}-api-layer`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownDatabase',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 4,
						stackName: `${PREFIX}-database`,
					})
				],
				placement: {
					justAfter: deployCIStage
				},
				stageName: 'CITeardown'
			});

			deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Teardown the dev environment?',
						runOrder: 1
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownClient',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 2,
						stackName: `${PREFIX}-client`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownAPILayer',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 3,
						stackName: `${PREFIX}-api-layer`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownDatabase',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 4,
						stackName: `${PREFIX}-database`,
					})
				],
				placement: {
					justAfter: teardownCIStage
				},
				stageName: 'DevTeardown'
			});
		}

		if (props.deploymentType === 'release') {
			const deployStgStage = deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the staging environment?'
					}),
					stage1DeployDatabaseAction,
					stage1DeployAPILayerAction,
					stage1DeployClientAction
				],
				placement: {
					justAfter: buildStage
				},
				stageName: 'DeployToStg',
			});
			deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the production environment?'
					}),
					stage2DeployDatabaseAction,
					stage2DeployAPILayerAction,
					stage2DeployClientAction
				],
				placement: {
					justAfter: deployStgStage
				},
				stageName: 'DeployToProd',
			});
		}

		// Make sure the deployment role can get the artifacts from the S3 bucket
		// deploymentPipeline.artifactBucket.grantRead(stage1DeployClientAction.deploymentRole);

		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: [
					's3:GetObject'
				],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('codebuild.amazonaws.com')],
				resources: [
					`${artifactBucket.bucketArn}/*`
				]
			}));
		artifactBucket.addToResourcePolicy(new PolicyStatement({
			actions: [
				's3:*'
			],
			effect: Effect.ALLOW,
			principals: [new ServicePrincipal('cloudformation.amazonaws.com')],
			resources: [
				`${artifactBucket.bucketArn}`,
				`${artifactBucket.bucketArn}/*`
			]
		}));
		artifactBucket.addToResourcePolicy(new PolicyStatement({
			actions: [
				's3:DeleteObject',
				's3:GetObject',
				's3:GetObjectVersion',
				's3:ListBucket',
				's3:PutObject'
			],
			effect: Effect.ALLOW,
			principals: [new ServicePrincipal('codepipeline.amazonaws.com')],
			resources: [
				`${artifactBucket.bucketArn}`,
				`${artifactBucket.bucketArn}/*`
			]
		}));
		artifactBucket.addToResourcePolicy(new PolicyStatement({
			actions: [
				's3:GetObject',
				's3:GetObjectVersion',
				's3:ListBucket'
			],
			effect: Effect.ALLOW,
			principals: [new AccountPrincipal(STACK.account), new AccountPrincipal(props.devAccountId), new AccountPrincipal(props.ciAccountId), new AccountPrincipal(props.prodAccountId)],
			resources: [
				`${artifactBucket.bucketArn}`,
				`${artifactBucket.bucketArn}/*`
			]
		}));
		artifactBucket.addToResourcePolicy(new PolicyStatement({
			actions: [
				's3:PutObject'
			],
			conditions: {
				Null: {
					's3:x-amz-server-side-encryption': 'true'
				}
			},
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			resources: [
				`${artifactBucket.bucketArn}`,
				`${artifactBucket.bucketArn}/*`
			]
		}));
		artifactBucket.addToResourcePolicy(new PolicyStatement({
			actions: [
				's3:*'
			],
			conditions: {
				Bool: {
					'aws:SecureTransport': 'false'
				}
			},
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			resources: [
				`${artifactBucket.bucketArn}`,
				`${artifactBucket.bucketArn}/*`
			]
		}));
	}
}
