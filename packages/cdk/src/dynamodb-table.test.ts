import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {DynamodbTable} from './dynamodb-table';

describe('[dynamodb-table.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create a DynamoDB table', async () => {
			const stack = new DynamodbTable(new Stack(), 'DynamodbTable', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
