import {CfnParameter, Construct, Duration, Stack, StackProps, Tag} from '@aws-cdk/core';
import {Code, Function, Runtime, Tracing} from '@aws-cdk/aws-lambda';
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs';

export interface Props extends StackProps {
}

export class TypescriptLambda extends Stack {

	constructor(scope: Construct, id: string, props: Props) {
		super(scope, id, props);

		const environmentParameter = new CfnParameter(this, 'Environment', {
			allowedValues: ['dev', 'ci', 'stg', 'prod'],
			description: 'TBC',
			type: 'String'
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

		const uniquePrefixParameter = new CfnParameter(this, 'UniquePrefix', {
			type: 'String',
			description: 'TBC'
		});

		Tag.add(this, 'Environment', `${environmentParameter.value}`);
		Tag.add(this, 'ServiceCode', `${serviceCodeParameter.value}`);
		Tag.add(this, 'ServiceName', `${serviceNameParameter.value}`);
		Tag.add(this, 'ServiceOwner', `${serviceOwnerParameter.value}`);

		const stack = Stack.of(this);
		const resourcePrefix = `${uniquePrefixParameter.value}-${environmentParameter.value}-${stack.region}`;

		const lambdaFunction = new Function(this, 'TypeScriptLambda', {
			code: Code.fromInline('exports.handler = function(event, ctx, cb) { return cb(null, "hi"); }'),
			description: 'TBC',
			functionName: `${resourcePrefix}-typescript-lambda`,
			handler: 'index.handler',
			memorySize: 128,
			runtime: Runtime.NODEJS_12_X,
			timeout: Duration.seconds(30),
			tracing: Tracing.ACTIVE
		});

		new LogGroup(this, 'TypeScriptLambdaLogs', {
			logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
			retention: RetentionDays.THREE_DAYS
		});
	}
}
