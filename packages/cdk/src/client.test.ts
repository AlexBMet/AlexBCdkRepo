import { Client } from './client';
import { Stack } from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies

describe('[client.ts] unit tests', () => {
	describe('[stack]', () => {
		it('must create an S3 bucket', async () => {
			const stack = new Client(new Stack(), 'ClientStack', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
