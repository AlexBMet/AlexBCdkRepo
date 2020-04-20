import {App} from '@aws-cdk/core';
import {APILayer} from './api-layer';
import {Client} from './client';
import {Database} from './database';
import {DeploymentPipeline} from './deployment-pipeline';

const stacks = new App();

new Client(stacks, 'Client', {});

new APILayer(stacks, 'APILayer', {});

new Database(stacks, 'Database', {});

// TODO: Replace with environment variables form process.env
new DeploymentPipeline(stacks, 'DeploymentPipeline', {
	devAccountId: '080660350717',
	ciAccountId: '896187182741',
	prodAccountId: '080660350717', // TODO: Replace me with PROD ID
	deploymentType: 'feature',
	serviceCode: 'WINCCC',
	serviceName: 'Cloud Team',
	serviceOwner: 'Cloud Team',
	sourceBranch: 'matt2-cdk-pipeline',
	uniquePrefix: 'matt3'
});

stacks.synth();
