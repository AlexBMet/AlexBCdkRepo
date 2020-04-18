import {CfnParameter, Construct, RemovalPolicy, SecretValue, Stack, StackProps, Tag} from '@aws-cdk/core';
import {Artifact, Pipeline} from '@aws-cdk/aws-codepipeline';
import {
	CloudFormationCreateUpdateStackAction, CloudFormationDeleteStackAction,
	CodeBuildAction,
	GitHubSourceAction, ManualApprovalAction
} from '@aws-cdk/aws-codepipeline-actions';
import {BuildSpec, LinuxBuildImage, PipelineProject} from '@aws-cdk/aws-codebuild';
import {
	AccountPrincipal,
	AccountRootPrincipal, AnyPrincipal,
	Effect,
	PolicyStatement,
	Role,
	ServicePrincipal
} from '@aws-cdk/aws-iam';
import {Bucket, BucketEncryption} from '@aws-cdk/aws-s3';
import {Key} from '@aws-cdk/aws-kms';

// export interface Props extends StackProps {
// 	readonly deploymentType: 'feature' | 'release';
// 	readonly mgmtAccountId: string;
// 	readonly devAccountId: string;
// 	readonly ciAccountId: string;
// 	readonly sourceBranch: string;
// 	readonly uniquePrefix: string;
// }


export interface Props extends StackProps {
}

export class DeploymentPipeline extends Stack {

	constructor(scope: Construct, id: string, props: Props) {
		super(scope, id, props);

		const devAccountIdParameter = new CfnParameter(this, 'DevAccountId', {
			type: 'String',
			default: '080660350717',
			description: 'TBC'
		});

		const deploymentTypeParameter = new CfnParameter(this, 'DeploymentType', {
			allowedValues: ['feature', 'release'],
			type: 'String',
			default: 'feature',
			description: 'TBC'
		});

		const serviceCodeParameter = new CfnParameter(this, 'ServiceCode', {
			type: 'String',
			description: 'TBC'
		});

		const serviceNameParameter = new CfnParameter(this, 'ServiceName', {
			type: 'String',
			description: 'TBC'
		});

		const serviceOwnerParameter = new CfnParameter(this, 'ServiceOwner', {
			type: 'String',
			description: 'TBC'
		});

		const sourceBranchParameter = new CfnParameter(this, 'SourceBranch', {
			type: 'String',
			default: 'master',
			description: 'TBC'
		});

		const uniquePrefixParameter = new CfnParameter(this, 'UniquePrefix', {
			type: 'String',
			description: 'TBC'
		});

		Tag.add(this, 'ServiceCode', `${serviceCodeParameter.value}`);
		Tag.add(this, 'ServiceName', `${serviceNameParameter.value}`);
		Tag.add(this, 'ServiceOwner', `${serviceOwnerParameter.value}`);

		const stack = Stack.of(this);
		const resourcePrefix = `${uniquePrefixParameter.value}-${deploymentTypeParameter.value}-${stack.region}`;

		// Role definitions
		const devPipelineAutomationRole = Role.fromRoleArn(this, 'TypeScriptLambdaContextRole', `arn:aws:iam::${devAccountIdParameter.value}:role/PipelineAutomationRole`);
		const mgmtPipelineAutomationRole = Role.fromRoleArn(this, 'DeploymentPipelineRole', `arn:aws:iam::${stack.account}:role/PipelineAutomationRole`);

		// Source resources
		const oauthToken = SecretValue.secretsManager('GitHubToken');
		const infrastructureSourceOutput = new Artifact('SourceOutput');

		const encryptionKey = new Key(this, 'FeatureKMSKey', {
			alias: `alias/${uniquePrefixParameter.value}/${stack.region}/feature/key`,
			description: 'KMS key for the feature pipeline',
			enableKeyRotation: false,
			removalPolicy: RemovalPolicy.DESTROY
		});

		const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: `${resourcePrefix}-artifact-bucket`,
			encryption: BucketEncryption.KMS,
			encryptionKey,
			removalPolicy: RemovalPolicy.DESTROY
		});

		// TypeScript lambda build resources
		const typeScriptLambdaBuild = new PipelineProject(this, 'TypeScriptLambdaBuild', {
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
							'cdk synth TypeScriptLambda > lambda.template.yaml'
						],
					},
				},
				artifacts: {
					'base-directory': '$CODEBUILD_SRC_DIR/packages/cdk',
					files: [
						'bucket.template.yaml',
						'lambda.template.yaml'
					]
				}
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_2_0,
			},
			projectName: `${resourcePrefix}-typescript-lambda-build`,
			role: mgmtPipelineAutomationRole
		});

		const typeScriptLambdaBuildOutput = new Artifact('CdkBuildOutput');

		new Pipeline(this, 'DeploymentPipeline', {
			artifactBucket,
			pipelineName: `${resourcePrefix}-deployment-pipeline`,
			restartExecutionOnUpdate: false,
			role: mgmtPipelineAutomationRole,
			stages: [
				{
					stageName: 'Source',
					actions: [new GitHubSourceAction({
						actionName: 'Source',
						owner: 'AlexBMet',
						repo: 'AlexBCdkRepo',
						branch: `${sourceBranchParameter.value}`,
						oauthToken,
						output: infrastructureSourceOutput,
					})],
				},
				{
					stageName: 'Build',
					actions: [new CodeBuildAction({
						actionName: 'BuildTypeScriptLambda',
						project: typeScriptLambdaBuild,
						input: infrastructureSourceOutput,
						outputs: [typeScriptLambdaBuildOutput],
					})]
				},
				{
					actions: [
						new CloudFormationCreateUpdateStackAction({
							account: '080660350717',
							actionName: 'DeployS3Bucket',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							parameterOverrides: {
								'Environment': 'dev',
								'ServiceCode': `${serviceCodeParameter.value}`,
								'ServiceName': `${serviceNameParameter.value}`,
								'ServiceOwner': `${serviceOwnerParameter.value}`,
								'UniquePrefix': `${uniquePrefixParameter.value}`
							},
							role: devPipelineAutomationRole,
							stackName: `${resourcePrefix}-cross-account-bucket`,
							templatePath: typeScriptLambdaBuildOutput.atPath('bucket.template.yaml')
						}),
						new CloudFormationCreateUpdateStackAction({
							account: '080660350717',
							actionName: 'DeployTypeScriptLambda',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							parameterOverrides: {
								'Environment': 'dev',
								'ServiceCode': `${serviceCodeParameter.value}`,
								'ServiceName': `${serviceNameParameter.value}`,
								'ServiceOwner': `${serviceOwnerParameter.value}`,
								'UniquePrefix': `${uniquePrefixParameter.value}`
							},
							role: devPipelineAutomationRole,
							stackName: `${resourcePrefix}-typescript-lambda`,
							templatePath: typeScriptLambdaBuildOutput.atPath('lambda.template.yaml')
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
							actionName: 'TeardownTypeScriptLambda',
							adminPermissions: false,
							deploymentRole: devPipelineAutomationRole,
							role: devPipelineAutomationRole,
							runOrder: 2,
							stackName: `${resourcePrefix}-cross-account-bucket`,
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
			principals: [new AccountPrincipal(stack.account), new AccountPrincipal(devAccountIdParameter.value)],
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