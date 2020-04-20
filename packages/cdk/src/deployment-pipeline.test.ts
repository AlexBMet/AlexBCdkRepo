import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {DeploymentPipeline} from './deployment-pipeline';

describe('[deployment-pipeline.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create a feature CodePipeline', async () => {
			const stack = new DeploymentPipeline(new Stack(), 'DeploymentPipeline', {
				devAccountId: '123',
				ciAccountId: '456',
				prodAccountId: '789',
				deploymentType: 'feature',
				serviceCode: 'CI',
				serviceName: 'Continous Integration',
				serviceOwner: 'Continous Integragtion',
				sourceBranch: 'master',
				uniquePrefix: 'ghostrider'
			});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});

		it('must create a release CodePipeline', async () => {
			const stack = new DeploymentPipeline(new Stack(), 'DeploymentPipeline', {
				devAccountId: '123',
				ciAccountId: '456',
				prodAccountId: '789',
				deploymentType: 'release',
				serviceCode: 'CI',
				serviceName: 'Continous Integration',
				serviceOwner: 'Continous Integragtion',
				sourceBranch: 'master',
				uniquePrefix: 'ghostrider'
			});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
