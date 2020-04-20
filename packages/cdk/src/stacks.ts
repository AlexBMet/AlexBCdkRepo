import {App} from '@aws-cdk/core';
import {config} from 'dotenv';
import {APILayer} from './api-layer';
import {Client} from './client';
import {Database} from './database';
import {DeploymentPipeline} from './deployment-pipeline';

config();
const stacks = new App();

new Client(stacks, 'Client', {});

new APILayer(stacks, 'APILayer', {});

new Database(stacks, 'Database', {});

new DeploymentPipeline(stacks, `DeploymentPipeline`, {
	devAccountId: process.env.DEV_ACCOUNT as string,
	ciAccountId: process.env.CI_ACCOUNT as string,
	prodAccountId: process.env.PROD_ACCOUNT as string,
	deploymentType: process.env.DEPLOYMENT_TYPE as 'feature' | 'release',
	serviceCode: 'WINCCC',
	serviceName: 'Cloud Team',
	serviceOwner: 'Cloud Team',
	sourceBranch: process.env.SOURCE_BRANCH as string,
	uniquePrefix: process.env.UNIQUE_PREFIX as string
});

stacks.synth();
