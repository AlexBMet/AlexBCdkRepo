import { AccountPrincipal, Effect, PolicyStatement, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Bucket, HttpMethods } from '@aws-cdk/aws-s3';
import { CfnOutput, CfnParameter, Construct, RemovalPolicy, Stack, StackProps, Tag } from '@aws-cdk/core';

export class Client extends Stack {
	public readonly deployBucketName: string;

	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const ENVIRONMENT = new CfnParameter(this, 'Environment', {
			allowedValues: ['dev', 'ci', 'stg', 'prod'],
			description: 'TBC',
			type: 'String',
		});
		const SERVICE_CODE = new CfnParameter(this, 'ServiceCode', {
			type: 'String',
			description: 'TBC',
		});
		const SERVICE_NAME = new CfnParameter(this, 'ServiceName', {
			type: 'String',
			description: 'TBC',
		});
		const SERVICE_OWNER = new CfnParameter(this, 'ServiceOwner', {
			type: 'String',
			description: 'TBC',
		});

		const BUCKET_NAME = new CfnParameter(this, 'BucketName', {
			type: 'String',
			description: 'TBC',
		});

		const ACCOUNT_ID = new CfnParameter(this, 'AccountId', {
			type: 'String',
			description: 'TBC',
		});

		const STACK_ACCOUNT = new CfnParameter(this, 'StackAccount', {
			type: 'String',
			description: 'TBC',
		});

		Tag.add(this, 'Environment', `${ENVIRONMENT.value}`);
		Tag.add(this, 'ServiceCode', `${SERVICE_CODE.value}`);
		Tag.add(this, 'ServiceName', `${SERVICE_NAME.value}`);
		Tag.add(this, 'ServiceOwner', `${SERVICE_OWNER.value}`);

		const websiteBucket = new Bucket(this, 'WebsiteBucket', {
			bucketName: `${BUCKET_NAME.value}`,
			removalPolicy: RemovalPolicy.DESTROY,
			websiteIndexDocument: 'index.html',
			websiteErrorDocument: 'error.html',
			publicReadAccess: false,
			cors: [
				{
					allowedOrigins: ['*'],
					allowedMethods: [HttpMethods.GET],
				},
			],
		});

		websiteBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('codebuild.amazonaws.com')],
				resources: [`${websiteBucket.bucketArn}/*`],
			})
		);

		websiteBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('codepipeline.amazonaws.com')],
				resources: [`${websiteBucket.bucketArn}`, `${websiteBucket.bucketArn}/*`],
			})
		);

		websiteBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('cloudformation.amazonaws.com')],
				resources: [`${websiteBucket.bucketArn}`, `${websiteBucket.bucketArn}/*`],
			})
		);

		websiteBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:*'],
				effect: Effect.ALLOW,
				principals: [
					new AccountPrincipal(STACK_ACCOUNT.value),
					new AccountPrincipal(ACCOUNT_ID.value),
					// new AccountPrincipal(props.ciAccountId),
					// new AccountPrincipal(props.prodAccountId),
				],
				resources: [`${websiteBucket.bucketArn}`, `${websiteBucket.bucketArn}/*`],
			})
		);

		this.deployBucketName = websiteBucket.bucketName;

		new CfnOutput(this, 'websiteBucketUrl', { value: websiteBucket.bucketWebsiteUrl });
	}
}
