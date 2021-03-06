import { AccountPrincipal, AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';
import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from '@aws-cdk/aws-codebuild';
import {
	CloudFormationCreateUpdateStackAction,
	CloudFormationDeleteStackAction,
	CodeBuildAction,
	GitHubSourceAction,
	ManualApprovalAction,
	S3DeployAction,
} from '@aws-cdk/aws-codepipeline-actions';
import { Construct, RemovalPolicy, SecretValue, Stack, StackProps, Tag } from '@aws-cdk/core';
import { CloudFormationCapabilities } from '@aws-cdk/aws-cloudformation';
import { Key } from '@aws-cdk/aws-kms';
import { TAGS } from './tags';

export interface Props extends StackProps {
	readonly devAccountId: string;
	readonly ciAccountId: string;
	readonly prodAccountId: string;
	readonly deploymentType: 'feature' | 'release';
	readonly sourceBranch: string;
	readonly uniquePrefix: string;
	readonly websiteBucketName: string;
}

export class DeploymentPipeline extends Stack {
	constructor(scope: Construct, id: string, props: Props) {
		super(scope, id, props);

		const STACK = Stack.of(this);

		const PREFIX = `${props.uniquePrefix}-${props.deploymentType}-${STACK.region}`; // TODO: This doesn't work for the stack names...

		Tag.add(this, 'Deployment', `${props.deploymentType}`);

		// Use existing PARs without attaching additional policy
		const devPipelineAutomationRole = Role.fromRoleArn(
			this,
			'DevPipelineAutomationRole',
			`arn:aws:iam::${props.devAccountId}:role/PipelineAutomationRole`,
			{ mutable: false }
		);
		const ciPipelineAutomationRole = Role.fromRoleArn(
			this,
			'CIPipelineAutomationRole',
			`arn:aws:iam::${props.ciAccountId}:role/PipelineAutomationRole`,
			{ mutable: false }
		);
		const prodPipelineAutomationRole = Role.fromRoleArn(
			this,
			'ProdPipelineAutomationRole',
			`arn:aws:iam::${props.prodAccountId}:role/PipelineAutomationRole`,
			{ mutable: false }
		);
		const mgmtPipelineAutomationRole = Role.fromRoleArn(
			this,
			'MgmtPipelineAutomationRole',
			`arn:aws:iam::${STACK.account}:role/PipelineAutomationRole`,
			{ mutable: false }
		);

		const oauthToken = SecretValue.secretsManager('GitHubToken');
		const infrastructureSourceOutput = new Artifact('SourceOutput');

		const encryptionKey = new Key(this, 'FeatureKMSKey', {
			alias: `alias/${props.uniquePrefix}/${STACK.region}/${props.deploymentType}/key`,
			description: `KMS key for the ${props.deploymentType} pipeline`,
			enableKeyRotation: false,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		const ARTIFACT_BUCKET_NAME = `${PREFIX}-artifact-bucket`;
		const deployType1 = props.deploymentType === 'release' ? 'stg' : 'dev';
		const deployType2 = props.deploymentType === 'release' ? 'prod' : 'ci';

		const STAGE_1_BUCKET_NAME = `${PREFIX}-${deployType1}-website-bucket`;
		const STAGE_2_BUCKET_NAME = `${PREFIX}-${deployType2}-website-bucket`;

		const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: ARTIFACT_BUCKET_NAME,
			encryption: BucketEncryption.KMS,
			encryptionKey,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		const websiteBuild = new PipelineProject(this, 'WebsiteBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/website',
					files: ['index.html'],
				},
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_3_0,
				computeType: ComputeType.MEDIUM,
			},
			projectName: `${PREFIX}-website-build`,
			role: mgmtPipelineAutomationRole,
		});

		const cdkBuild = new PipelineProject(this, 'CDKBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: ['npm install -g cdk', 'yarn'],
					},
					build: {
						commands: [
							'cd $CODEBUILD_SRC_DIR/packages/cdk',
							'yarn test',
							'cdk synth Client > client.template.yaml',
							'cdk synth APILayer > api.template.yaml',
							'cdk synth Database > database.template.yaml',
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/cdk',
					files: ['client.template.yaml', 'api.template.yaml', 'database.template.yaml'],
				},
				reports: {
					'unit-tests': {
						'base-directory': '$CODEBUILD_SRC_DIR/packages/cdk/reports',
						files: ['junit.xml'],
					},
				},
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_3_0,
				computeType: ComputeType.MEDIUM,
			},
			projectName: `${PREFIX}-cdk-build`,
			role: mgmtPipelineAutomationRole,
		});

		const lambdaBuild = new PipelineProject(this, 'LambdaBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: ['yarn'],
					},
					build: {
						commands: [
							'cd $CODEBUILD_SRC_DIR/packages/lambda',
							'yarn test',
							'yarn build',
							'cd $CODEBUILD_SRC_DIR',
							'yarn install --production --ignore-scripts --prefer-offline',
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/lambda',
					files: ['dist/*', 'node_modules/*'],
				},
				reports: {
					'unit-tests': {
						'base-directory': '$CODEBUILD_SRC_DIR/packages/lambda/reports',
						files: ['junit.xml'],
					},
				},
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_3_0,
				computeType: ComputeType.MEDIUM,
			},
			projectName: `${PREFIX}-lambda-build`,
			role: mgmtPipelineAutomationRole,
		});

		const emptyCiBucketsBuild = new PipelineProject(this, 'EmptyCiBucketBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: [
							'apt-get update',
							'apt-get -y install jq',
							'apt-get -y install python3-pip',
							'pip3 install awscli --upgrade',
						],
					},
					build: {
						commands: [
							'echo Assuming PipelineAutomationRole to empty buckets',
							'TEMP_ROLE=$(aws sts assume-role --role-arn arn:aws:iam::${AWS_ACCOUNT}:role/PipelineAutomationRole --role-session-name AssumePipelineAutomationRole)',
							"AKID=$(echo $TEMP_ROLE | jq -r '.Credentials.AccessKeyId')",
							"SAK=$(echo $TEMP_ROLE | jq -r '.Credentials.SecretAccessKey')",
							"ST=$(echo $TEMP_ROLE | jq -r '.Credentials.SessionToken')",
							'aws configure set aws_access_key_id $AKID ',
							'aws configure set aws_secret_access_key $SAK',
							'aws configure set aws_session_token $ST',
							'aws s3 rm s3://${BUCKET_NAME} --recursive',
						],
					},
				},
			}),
			projectName: `${PREFIX}-ci-empty-bucket-build`,
			role: mgmtPipelineAutomationRole,
		});

		const emptyDevBucketsBuild = new PipelineProject(this, 'EmptyDevBucketBuild', {
			buildSpec: BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: [
							'apt-get update',
							'apt-get -y install jq',
							'apt-get -y install python3-pip',
							'pip3 install awscli --upgrade',
						],
					},
					build: {
						commands: [
							'echo Assuming PipelineAutomationRole to empty buckets',
							'TEMP_ROLE=$(aws sts assume-role --role-arn arn:aws:iam::${AWS_ACCOUNT}:role/PipelineAutomationRole --role-session-name AssumePipelineAutomationRole)',
							"AKID=$(echo $TEMP_ROLE | jq -r '.Credentials.AccessKeyId')",
							"SAK=$(echo $TEMP_ROLE | jq -r '.Credentials.SecretAccessKey')",
							"ST=$(echo $TEMP_ROLE | jq -r '.Credentials.SessionToken')",
							'aws configure set aws_access_key_id $AKID ',
							'aws configure set aws_secret_access_key $SAK',
							'aws configure set aws_session_token $ST',
							'aws s3 rm s3://${BUCKET_NAME} --recursive',
						],
					},
				},
			}),
			projectName: `${PREFIX}-empty-dev-bucket-build`,
			role: mgmtPipelineAutomationRole,
		});

		const websiteBuildOutput = new Artifact('WebsiteBuildOutput');
		const cdkBuildOutput = new Artifact('CDKBuildOutput');
		const lambdaBuildOutput = new Artifact('LambdaBuildOutput');

		const deploymentPipeline = new Pipeline(this, 'DeploymentPipeline', {
			artifactBucket,
			pipelineName: `${PREFIX}-deployment-pipeline`,
			restartExecutionOnUpdate: false,
			role: mgmtPipelineAutomationRole,
			stages: [],
		});

		const sourceStage = deploymentPipeline.addStage({
			stageName: 'Source',
			actions: [
				new GitHubSourceAction({
					actionName: 'Source',
					owner: 'AlexBMet',
					repo: 'AlexBCdkRepo',
					branch: `${props.sourceBranch}`,
					oauthToken,
					output: infrastructureSourceOutput,
				}),
			],
		});

		const buildStage = deploymentPipeline.addStage({
			stageName: 'Build',
			actions: [
				new CodeBuildAction({
					actionName: 'SynthesiseTemplates',
					project: cdkBuild,
					input: infrastructureSourceOutput,
					outputs: [cdkBuildOutput],
					role: mgmtPipelineAutomationRole,
					runOrder: 1,
				}),
				new CodeBuildAction({
					actionName: 'BuildLambda',
					project: lambdaBuild,
					input: infrastructureSourceOutput,
					outputs: [lambdaBuildOutput],
					role: mgmtPipelineAutomationRole,
					runOrder: 2,
				}),
				new CodeBuildAction({
					actionName: 'BuildWebsite',
					project: websiteBuild,
					input: infrastructureSourceOutput,
					outputs: [websiteBuildOutput],
					role: mgmtPipelineAutomationRole,
					runOrder: 3,
				}),
			],
			placement: {
				justAfter: sourceStage,
			},
		});

		const stage1DeployDatabaseAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployDatabase',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'stg' : 'dev',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				UniquePrefix: `${props.uniquePrefix}`,
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 2,
			stackName: `${PREFIX}-database`,
			templatePath: cdkBuildOutput.atPath('database.template.yaml'),
		});

		const stage2DeployDatabaseAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployDatabase',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'prod' : 'ci',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				UniquePrefix: `${props.uniquePrefix}`,
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 2,
			stackName: `${PREFIX}-database`,
			templatePath: cdkBuildOutput.atPath('database.template.yaml'),
		});

		const stage1DeployAPILayerAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployAPILayer',
			adminPermissions: false,
			capabilities: [CloudFormationCapabilities.NAMED_IAM],
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			extraInputs: [lambdaBuildOutput],
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'stg' : 'dev',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				SourceBucketName: `${lambdaBuildOutput.bucketName}`,
				SourceObjectKey: `${lambdaBuildOutput.objectKey}`,
				UniquePrefix: `${props.uniquePrefix}`,
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 3,
			stackName: `${PREFIX}-api-layer`,
			templatePath: cdkBuildOutput.atPath('api.template.yaml'),
		});

		const stage2DeployAPILayerAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployAPILayer',
			adminPermissions: false,
			capabilities: [CloudFormationCapabilities.NAMED_IAM],
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			extraInputs: [lambdaBuildOutput],
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'prod' : 'ci',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				SourceBucketName: `${lambdaBuildOutput.bucketName}`,
				SourceObjectKey: `${lambdaBuildOutput.objectKey}`,
				UniquePrefix: `${props.uniquePrefix}`,
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 3,
			stackName: `${PREFIX}-api-layer`,
			templatePath: cdkBuildOutput.atPath('api.template.yaml'),
		});

		const stage1DeployClientAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
			actionName: 'DeployClient',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'stg' : 'dev',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				BucketName: STAGE_1_BUCKET_NAME,
				AccountId: props.deploymentType === 'release' ? props.ciAccountId : props.devAccountId,
				StackAccount: STACK.account,
			},
			role: props.deploymentType === 'release' ? ciPipelineAutomationRole : devPipelineAutomationRole,
			runOrder: 4,
			stackName: `${PREFIX}-client`,
			templatePath: cdkBuildOutput.atPath('client.template.yaml'),
		});

		const stage2DeployClientAction = new CloudFormationCreateUpdateStackAction({
			account: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
			actionName: 'DeployClient',
			adminPermissions: false,
			deploymentRole: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			parameterOverrides: {
				Environment: props.deploymentType === 'release' ? 'prod' : 'ci',
				ServiceCode: TAGS.ServiceCode,
				ServiceName: TAGS.ServiceName,
				ServiceOwner: TAGS.ServiceOwner,
				BucketName: STAGE_2_BUCKET_NAME,
				AccountId: props.deploymentType === 'release' ? props.prodAccountId : props.ciAccountId,
				StackAccount: STACK.account,
			},
			role: props.deploymentType === 'release' ? prodPipelineAutomationRole : ciPipelineAutomationRole,
			runOrder: 4,
			stackName: `${PREFIX}-client`,
			templatePath: cdkBuildOutput.atPath('client.template.yaml'),
		});

		const stage1DeployWebsiteAction = new S3DeployAction({
			actionName: 'DeployWebsite',
			bucket: Bucket.fromBucketName(this, 'Stage1DeployBucket', STAGE_1_BUCKET_NAME),
			input: websiteBuildOutput,
			role: mgmtPipelineAutomationRole,
			runOrder: 5,
		});

		const stage2DeployWebsiteAction = new S3DeployAction({
			actionName: 'DeployWebsite',
			bucket: Bucket.fromBucketName(this, 'Stage2DeployBucket', STAGE_2_BUCKET_NAME),
			input: websiteBuildOutput,
			role: mgmtPipelineAutomationRole,
			runOrder: 5,
		});

		if (props.deploymentType === 'feature') {
			const deployDevStage = deploymentPipeline.addStage({
				actions: [
					stage1DeployDatabaseAction,
					stage1DeployAPILayerAction,
					stage1DeployClientAction,
					stage1DeployWebsiteAction,
				],
				placement: {
					justAfter: buildStage,
				},
				stageName: 'DeployToDev',
			});

			const deployCIStage = deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the CI environment?',
						role: mgmtPipelineAutomationRole,
						runOrder: 1,
					}),
					stage2DeployDatabaseAction,
					stage2DeployAPILayerAction,
					stage2DeployClientAction,
					stage2DeployWebsiteAction,
				],
				placement: {
					justAfter: deployDevStage,
				},
				stageName: 'DeployToCI',
			});

			// TODO: Add integration & E2E tests here

			const teardownCIStage = deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Teardown the ci environment?',
						role: mgmtPipelineAutomationRole,
						runOrder: 1,
					}),
					new CodeBuildAction({
						actionName: 'EmptyCiBucket',
						project: emptyCiBucketsBuild,
						input: infrastructureSourceOutput,
						environmentVariables: {
							BUCKET_NAME: { value: STAGE_2_BUCKET_NAME },
							AWS_ACCOUNT: { value: props.ciAccountId },
						},
						outputs: [],
						role: mgmtPipelineAutomationRole,
						runOrder: 2,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownClient',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 3,
						stackName: `${PREFIX}-client`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownAPILayer',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 4,
						stackName: `${PREFIX}-api-layer`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownDatabase',
						adminPermissions: false,
						deploymentRole: ciPipelineAutomationRole,
						role: ciPipelineAutomationRole,
						runOrder: 5,
						stackName: `${PREFIX}-database`,
					}),
				],
				placement: {
					justAfter: deployCIStage,
				},
				stageName: 'CITeardown',
			});

			deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Teardown the dev environment?',
						role: mgmtPipelineAutomationRole,
						runOrder: 1,
					}),
					new CodeBuildAction({
						actionName: 'EmptyDevBucket',
						project: emptyDevBucketsBuild,
						input: infrastructureSourceOutput,
						environmentVariables: {
							BUCKET_NAME: { value: STAGE_1_BUCKET_NAME },
							AWS_ACCOUNT: { value: props.devAccountId },
						},
						outputs: [],
						role: mgmtPipelineAutomationRole,
						runOrder: 2,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownClient',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 3,
						stackName: `${PREFIX}-client`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownAPILayer',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 4,
						stackName: `${PREFIX}-api-layer`,
					}),
					new CloudFormationDeleteStackAction({
						actionName: 'TeardownDatabase',
						adminPermissions: false,
						deploymentRole: devPipelineAutomationRole,
						role: devPipelineAutomationRole,
						runOrder: 5,
						stackName: `${PREFIX}-database`,
					}),
				],
				placement: {
					justAfter: teardownCIStage,
				},
				stageName: 'DevTeardown',
			});
		}

		if (props.deploymentType === 'release') {
			const deployStgStage = deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the staging environment?',
						role: mgmtPipelineAutomationRole,
					}),
					stage1DeployDatabaseAction,
					stage1DeployAPILayerAction,
					stage1DeployClientAction,
					stage1DeployWebsiteAction,
				],
				placement: {
					justAfter: buildStage,
				},
				stageName: 'DeployToStg',
			});
			deploymentPipeline.addStage({
				actions: [
					new ManualApprovalAction({
						actionName: 'Approve',
						additionalInformation: 'Deploy to the production environment?',
						role: mgmtPipelineAutomationRole,
					}),
					stage2DeployDatabaseAction,
					stage2DeployAPILayerAction,
					stage2DeployClientAction,
					stage2DeployWebsiteAction,
				],
				placement: {
					justAfter: deployStgStage,
				},
				stageName: 'DeployToProd',
			});
		}

		// Make sure the deployment role can get the artifacts from the S3 bucket
		// deploymentPipeline.artifactBucket.grantRead(stage1DeployClientAction.deploymentRole);

		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:GetObject'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('codebuild.amazonaws.com')],
				resources: [`${artifactBucket.bucketArn}/*`],
			})
		);
		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('cloudformation.amazonaws.com')],
				resources: [`${artifactBucket.bucketArn}`, `${artifactBucket.bucketArn}/*`],
			})
		);
		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:DeleteObject', 's3:GetObject', 's3:GetObjectVersion', 's3:ListBucket', 's3:PutObject'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('codepipeline.amazonaws.com')],
				resources: [`${artifactBucket.bucketArn}`, `${artifactBucket.bucketArn}/*`],
			})
		);
		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
				effect: Effect.ALLOW,
				principals: [
					new AccountPrincipal(STACK.account),
					new AccountPrincipal(props.devAccountId),
					new AccountPrincipal(props.ciAccountId),
					new AccountPrincipal(props.prodAccountId),
				],
				resources: [`${artifactBucket.bucketArn}`, `${artifactBucket.bucketArn}/*`],
			})
		);
		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:PutObject'],
				conditions: {
					Null: {
						's3:x-amz-server-side-encryption': 'true',
					},
				},
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				resources: [`${artifactBucket.bucketArn}`, `${artifactBucket.bucketArn}/*`],
			})
		);
		artifactBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				resources: [`${artifactBucket.bucketArn}`, `${artifactBucket.bucketArn}/*`],
			})
		);
	}
}
