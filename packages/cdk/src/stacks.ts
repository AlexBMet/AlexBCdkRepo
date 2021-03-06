import { APILayer } from './api-layer';
import { App } from '@aws-cdk/core';
import { Client } from './client';
import { Database } from './database';
import { DeploymentPipeline } from './deployment-pipeline';
import { TAGS } from './tags';
import { config } from 'dotenv';

config();
const stacks = new App();

const DEV_ACCOUNT = process.env.DEV_ACCOUNT as string;
const CI_ACCOUNT = process.env.CI_ACCOUNT as string;
const PROD_ACCOUNT = process.env.PROD_ACCOUNT as string;
const DEPLOYMENT_TYPE = process.env.DEPLOYMENT_TYPE as 'feature' | 'release';
const SOURCE_BRANCH = process.env.SOURCE_BRANCH as string;
const UNIQUE_PREFIX = process.env.UNIQUE_PREFIX as string;

const client = new Client(stacks, 'Client', {
	tags: TAGS,
	description: 'TBC',
});

new APILayer(stacks, 'APILayer', {
	description: 'TBC',
});

new Database(stacks, 'Database', {
	description: 'TBC',
});

new DeploymentPipeline(stacks, `DeploymentPipeline`, {
	ciAccountId: CI_ACCOUNT,
	deploymentType: DEPLOYMENT_TYPE,
	description: 'TBC',
	devAccountId: DEV_ACCOUNT,
	prodAccountId: PROD_ACCOUNT,
	sourceBranch: SOURCE_BRANCH,
	stackName: `${UNIQUE_PREFIX}-cdk-deployment-pipeline`,
	tags: TAGS,
	uniquePrefix: UNIQUE_PREFIX,
	websiteBucketName: client.deployBucketName,
});

stacks.synth();
