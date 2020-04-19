import {Bucket} from '@aws-cdk/aws-s3';
import {CfnParameter, Construct, RemovalPolicy, Stack, StackProps, Tag} from '@aws-cdk/core';

export class Client extends Stack {

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
		const UNIQUE_PREFIX = new CfnParameter(this, 'UniquePrefix', {
			type: 'String',
			description: 'TBC'
		});
		const PREFIX = `${UNIQUE_PREFIX.value}-${ENVIRONMENT.value}-${STACK.region}`;

		Tag.add(this, 'Environment', `${ENVIRONMENT.value}`);
		Tag.add(this, 'ServiceCode', `${SERVICE_CODE.value}`);
		Tag.add(this, 'ServiceName', `${SERVICE_NAME.value}`);
		Tag.add(this, 'ServiceOwner', `${SERVICE_OWNER.value}`);

		new Bucket(this, 'CrossAccountBucket', {
			bucketName: `${PREFIX}-client`,
			removalPolicy: RemovalPolicy.DESTROY
		});
	}
}
