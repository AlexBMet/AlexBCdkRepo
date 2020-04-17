import {CfnParameter, Construct, RemovalPolicy, Stack, StackProps} from '@aws-cdk/core';
import {Bucket} from '@aws-cdk/aws-s3';

export interface Props extends StackProps {
}

export class CrossAccountBucket extends Stack {

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

		const stack = Stack.of(this);
		const resourcePrefix = `${uniquePrefixParameter.value}-${environmentParameter.value}-${stack.region}`;

		new Bucket(this, 'CrossAccountBucket', {
			bucketName: `${resourcePrefix}-cross-account-bucket`,
			removalPolicy: RemovalPolicy.DESTROY
		});
	}
}
