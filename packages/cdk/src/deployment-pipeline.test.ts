import { DeploymentPipeline } from './deployment-pipeline';
import { Stack } from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import { TAGS } from './tags';

describe('[deployment-pipeline.ts] unit tests', () => {
	describe('[stack]', () => {
		it('must create a feature CodePipeline', async () => {
			const stack = new DeploymentPipeline(new Stack(), 'DeploymentPipeline', {
				ciAccountId: '456',
				deploymentType: 'feature',
				description: 'Continous Integration',
				devAccountId: '123',
				prodAccountId: '789',
				sourceBranch: 'master',
				tags: TAGS,
				uniquePrefix: 'ghostrider',
				bucketName: 'myBucket',
			});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});

		it('must create a release CodePipeline', async () => {
			const stack = new DeploymentPipeline(new Stack(), 'DeploymentPipeline', {
				ciAccountId: '456',
				deploymentType: 'release',
				description: 'Continous Integration',
				devAccountId: '123',
				prodAccountId: '789',
				sourceBranch: 'master',
				tags: TAGS,
				uniquePrefix: 'ghostrider',
				bucketName: 'myBucket',
			});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
