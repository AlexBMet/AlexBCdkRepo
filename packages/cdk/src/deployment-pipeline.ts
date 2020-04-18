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
import {CfnParameter, Construct, RemovalPolicy, SecretValue, Stack, Tag} from '@aws-cdk/core';

export class DeploymentPipeline extends Stack {

	constructor(scope: Construct, id: string, props: {}) {
		super(scope, id, props);

		const STACK = Stack.of(this);
		const DEV_ACCOUNT = new CfnParameter(this, 'DevAccountId', {
			type: 'String',
			default: '080660350717',
			description: 'TBC'
		});
		const DEPLOYMENT_TYPE = new CfnParameter(this, 'DeploymentType', {
			allowedValues: ['feature', 'release'],
			type: 'String',
			default: 'feature',
			description: 'TBC'
		});
		const SERVICE_CODE = new CfnParameter(this, 'ServiceCode', {
			type: 'String',
			description: 'TBC'
		});
		const SERVICE_NAME = new CfnParameter(this, 'ServiceName', {
			type: 'String',
			description: 'TBC'
		});
		const SERVICE_OWNER = new CfnParameter(this, 'ServiceOwner', {
			type: 'String',
			description: 'TBC'
		});
		const SOURCE_BRANCH = new CfnParameter(this, 'SourceBranch', {
			type: 'String',
			default: 'master',
			description: 'TBC'
		});
		const UNIQUE_PREFIX = new CfnParameter(this, 'UniquePrefix', {
			description: 'TBC',
			type: 'String',
		});

		const PREFIX = `${UNIQUE_PREFIX.value}-${DEPLOYMENT_TYPE.value}-${STACK.region}`;

		Tag.add(this, 'Deployment', `${DEPLOYMENT_TYPE.value}`);
		Tag.add(this, 'ServiceCode', `${SERVICE_CODE.value}`);
		Tag.add(this, 'ServiceName', `${SERVICE_NAME.value}`);
		Tag.add(this, 'ServiceOwner', `${SERVICE_OWNER.value}`);

		const devPipelineAutomationRole = Role.fromRoleArn(this, 'TypeScriptLambdaContextRole', `arn:aws:iam::${DEV_ACCOUNT.value}:role/PipelineAutomationRole`);
		const mgmtPipelineAutomationRole = Role.fromRoleArn(this, 'DeploymentPipelineRole', `arn:aws:iam::${STACK.account}:role/PipelineAutomationRole`);
		const oauthToken = SecretValue.secretsManager('GitHubToken');
		const infrastructureSourceOutput = new Artifact('SourceOutput');

		const encryptionKey = new Key(this, 'FeatureKMSKey', {
			alias: `alias/${UNIQUE_PREFIX.value}/${STACK.region}/feature/key`,
			description: 'KMS key for the feature pipeline',
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
							'cdk synth CrossAccountBucket > bucket.template.yaml',
							'cdk synth TypeScriptLambda > lambda.template.yaml',
							'cdk synth DynamoDbTable > dynamodb.template.yaml'
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/cdk',
					files: [
						'bucket.template.yaml',
						'lambda.template.yaml',
						'dynamodb.template.yaml'
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

		const typeScriptLambdaBuild = new PipelineProject(this, 'TypeScriptLambdaBuild', {
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
			projectName: `${PREFIX}-typescript-lambda-build`,
			role: mgmtPipelineAutomationRole
		});

		const cdkBuildOutput = new Artifact('CDKBuildOutput');
		const typeScriptLambdaBuildOutput = new Artifact('TypeScriptLambdaBuildOutput');

		new Pipeline(this, 'DeploymentPipeline', {
			artifactBucket,
			pipelineName: `${PREFIX}-deployment-pipeline`,
			restartExecutionOnUpdate: false,
			role: mgmtPipelineAutomationRole,
			stages: [
				{
					stageName: 'Source',
					actions: [new GitHubSourceAction({
						actionName: 'Source',
						owner: 'AlexBMet',
						repo: 'AlexBCdkRepo',
						branch: `${SOURCE_BRANCH.value}`,
						oauthToken,
						output: infrastructureSourceOutput,
					})],
				},
				{
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
							actionName: 'BuildTypeScriptLambda',
							project: typeScriptLambdaBuild,
							input: infrastructureSourceOutput,
							outputs: [typeScriptLambdaBuildOutput],
							runOrder: 2
						})
					]
				},
				{
					actions: [
						new CloudFormationCreateUpdateStackAction({
							account: '080660350717',
							actionName: 'DeployDynamoDbTable',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							parameterOverrides: {
								'Environment': 'dev',
								'ServiceCode': `${SERVICE_CODE.value}`,
								'ServiceName': `${SERVICE_NAME.value}`,
								'ServiceOwner': `${SERVICE_OWNER.value}`,
								'UniquePrefix': `${UNIQUE_PREFIX.value}`
							},
							role: devPipelineAutomationRole,
							runOrder: 1,
							stackName: `${PREFIX}-dynamodb-table`,
							templatePath: cdkBuildOutput.atPath('dynamodb.template.yaml')
						}),
						new CloudFormationCreateUpdateStackAction({
							account: '080660350717',
							actionName: 'DeployTypeScriptLambda',
							adminPermissions: false,
							capabilities: [CloudFormationCapabilities.NAMED_IAM],
							deploymentRole: devPipelineAutomationRole,
							extraInputs: [typeScriptLambdaBuildOutput],
							parameterOverrides: {
								'Environment': 'dev',
								'ServiceCode': `${SERVICE_CODE.value}`,
								'ServiceName': `${SERVICE_NAME.value}`,
								'ServiceOwner': `${SERVICE_OWNER.value}`,
								'SourceBucketName': `${typeScriptLambdaBuildOutput.bucketName}`,
								'SourceObjectKey': `${typeScriptLambdaBuildOutput.objectKey}`,
								'UniquePrefix': `${UNIQUE_PREFIX.value}`
							},
							role: devPipelineAutomationRole,
							runOrder: 2,
							stackName: `${PREFIX}-typescript-lambda`,
							templatePath: cdkBuildOutput.atPath('lambda.template.yaml')
						}),
						new CloudFormationCreateUpdateStackAction({
							account: '080660350717',
							actionName: 'DeployS3Bucket',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							parameterOverrides: {
								'Environment': 'dev',
								'ServiceCode': `${SERVICE_CODE.value}`,
								'ServiceName': `${SERVICE_NAME.value}`,
								'ServiceOwner': `${SERVICE_OWNER.value}`,
								'UniquePrefix': `${UNIQUE_PREFIX.value}`
							},
							role: devPipelineAutomationRole,
							runOrder: 3,
							stackName: `${PREFIX}-cross-account-bucket`,
							templatePath: cdkBuildOutput.atPath('bucket.template.yaml')
						})
					],
					stageName: 'DeployToDev'
				},
				{
					actions: [
						new ManualApprovalAction({
							actionName: 'Approve',
							additionalInformation: 'Teardown the dev environment?',
							runOrder: 1
						}),
						new CloudFormationDeleteStackAction({
							actionName: 'TeardownS3Bucket',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							role: devPipelineAutomationRole,
							runOrder: 2,
							stackName: `${PREFIX}-cross-account-bucket`,
						}),
						new CloudFormationDeleteStackAction({
							actionName: 'TeardownTypeScriptLambda',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							role: devPipelineAutomationRole,
							runOrder: 3,
							stackName: `${PREFIX}-typescript-lambda`,
						}),
						new CloudFormationDeleteStackAction({
							actionName: 'TeardownDynamoDbTable',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							role: devPipelineAutomationRole,
							runOrder: 4,
							stackName: `${PREFIX}-dynamodb-table`,
						})
					],
					stageName: 'DevTeardown'
				}
			]
		});

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
			principals: [new AccountPrincipal(STACK.account), new AccountPrincipal(DEV_ACCOUNT.value)],
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
