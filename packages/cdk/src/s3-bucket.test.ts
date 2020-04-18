import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {CrossAccountBucket} from './s3-bucket';

describe('[s3-bucket.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create an S3 bucket', async () => {
			const stack = new CrossAccountBucket(new Stack(), 'CrossAccountBucket', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
