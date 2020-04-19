import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {Client} from './client';

describe('[client.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create an S3 bucket', async () => {
			const stack = new Client(new Stack(), 'ClientStack', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
