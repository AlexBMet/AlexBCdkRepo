import {AttributeType, BillingMode, Table} from '@aws-cdk/aws-dynamodb';
import {CfnParameter, Construct, RemovalPolicy, Stack, Tag} from '@aws-cdk/core';

export class Database extends Stack {

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

		new Table(this, 'Database', {
			billingMode: BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'id',
				type: AttributeType.STRING
			},
			removalPolicy: RemovalPolicy.DESTROY,
			tableName: `${PREFIX}-table`,
		});
	}
}
