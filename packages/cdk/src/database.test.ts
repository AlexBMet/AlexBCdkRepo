import { Database } from './database';
import { Stack } from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies

describe('[database.ts] unit tests', () => {
	describe('[stack]', () => {
		it('must create a DynamoDB table', async () => {
			const stack = new Database(new Stack(), 'DatabaseStack', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
