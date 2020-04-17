import {CfnParameter, Construct, RemovalPolicy, SecretValue, Stack, StackProps, Tag} from '@aws-cdk/core';
import {Artifact, Pipeline} from '@aws-cdk/aws-codepipeline';
import {CodeBuildAction, GitHubSourceAction} from '@aws-cdk/aws-codepipeline-actions';
import {BuildSpec, LinuxBuildImage, PipelineProject} from '@aws-cdk/aws-codebuild';
import {Role} from '@aws-cdk/aws-iam';
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

export interface Props extends StackProps {}

const mgmtAccountId = '835146719373';
const devAccountId = '080660350717';

export class BuildPipeline extends Stack {

	constructor(scope: Construct, id: string, props: Props) {
		super(scope, id, props);

		// const devAccountIdParameter = new CfnParameter(this, 'DevAccountId', {
		// 	type: 'String',
		// 	default: devAccountId,
		// 	description: 'TBC'
		// });

		const deploymentTypeParameter = new CfnParameter(this, 'DeploymentType', {
			allowedValues: ['feature', 'release'],
			type: 'String',
			default: 'feature',
			description: 'TBC'
		});

		const mgmtAccountIdParameter = new CfnParameter(this, 'MgmtAccountId', {
			type: 'String',
			default: mgmtAccountId,
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
			bucketName: `${resourcePrefix}-pipeline-artifacts`,
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
							'npm install',
							'npm install -g cdk',
							'npm install -g typescript',
						],
					},
					build: {
						commands: [
							'npm run build',
							'npm run cdk synth -- -o dist'
						],
					},
				}
			}),
			environment: {
				buildImage: LinuxBuildImage.STANDARD_2_0,
			},
			projectName: `${resourcePrefix}-typescript-lambda-build`,
			role: Role.fromRoleArn(this, 'TypeScriptLambdaBuildRole', `arn:aws:iam::${mgmtAccountIdParameter.value}:role/PipelineAutomationRole`)
		});

		const typeScriptLambdaBuildOutput = new Artifact('CdkBuildOutput');

		new Pipeline(this, 'DeploymentPipeline', {
			artifactBucket,
			pipelineName: `${resourcePrefix}-deployment-pipeline`,
			restartExecutionOnUpdate: false,
			role: Role.fromRoleArn(this, 'DeploymentPipelineRole', `arn:aws:iam::${mgmtAccountIdParameter.value}:role/PipelineAutomationRole`),
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
						actionName: 'CDK_Build',
						project: typeScriptLambdaBuild,
						input: infrastructureSourceOutput,
						outputs: [typeScriptLambdaBuildOutput],
					})]
				}
			]
		});
	}
}
