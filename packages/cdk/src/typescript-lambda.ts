import {Code, Function, Runtime, Tracing} from '@aws-cdk/aws-lambda';
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs';
import {CfnParameter, Construct, Duration, RemovalPolicy, Stack, Tag} from '@aws-cdk/core';

export class TypescriptLambda extends Stack {

	constructor(scope: Construct, id: string, props: {}) {
		super(scope, id, props);

		const STACK = Stack.of(this);
		const ENVIRONMENT = new CfnParameter(this, 'Environment', {
			allowedValues: ['dev', 'ci', 'stg', 'prod'],
			description: 'TBC',
			type: 'String'
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
		const BUCKET_NAME = new CfnParameter(this, 'SourceBucketName', {
			description: 'TBC',
			type: 'String'
		});
		const OBJECT_KEY = new CfnParameter(this, 'SourceObjectKey', {
			description: 'TBC',
			type: 'String'
		});
		const UNIQUE_PREFIX = new CfnParameter(this, 'UniquePrefix', {
			type: 'String',
			description: 'TBC'
		});
		const PREFIX = `${UNIQUE_PREFIX.value}-${ENVIRONMENT.value}-${STACK.region}`;

		Tag.add(this, 'Environment', `${ENVIRONMENT.value}`);
		Tag.add(this, 'ServiceCode', `${SERVICE_CODE.value}`);
		Tag.add(this, 'ServiceName', `${SERVICE_NAME.value}`);
		Tag.add(this, 'ServiceOwner', `${SERVICE_OWNER.value}`);

		// tslint:disable-next-line:function-constructor
		const lambdaFunction = new Function(this, 'TypeScriptLambda', {
			code: Code.fromCfnParameters({
				bucketNameParam: BUCKET_NAME,
				objectKeyParam: OBJECT_KEY
			}),
			description: 'TBC',
			functionName: `${PREFIX}-typescript-lambda`,
			handler: 'dist/index.handler',
			memorySize: 128,
			runtime: Runtime.NODEJS_12_X,
			timeout: Duration.seconds(30),
			tracing: Tracing.ACTIVE
		});

		new LogGroup(this, 'TypeScriptLambdaLogs', {
			logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
			retention: RetentionDays.THREE_DAYS,
			removalPolicy: RemovalPolicy.DESTROY
		});
	}
}
