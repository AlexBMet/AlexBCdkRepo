import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {DeploymentPipeline} from './deployment-pipeline';

describe('[deployment-pipeline.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create a CodePipeline', async () => {
			const stack = new DeploymentPipeline(new Stack(), 'DeploymentPipeline', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
