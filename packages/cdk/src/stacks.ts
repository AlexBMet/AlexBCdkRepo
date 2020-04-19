import {App} from '@aws-cdk/core';
import {APILayer} from './api-layer';
import {Client} from './client';
import {Database} from './database';
import {DeploymentPipeline} from './deployment-pipeline';

const stacks = new App();

new Client(stacks, 'Client', {});

new APILayer(stacks, 'APILayer', {});

new Database(stacks, 'Database', {});

new DeploymentPipeline(stacks, 'DeploymentPipeline', {});

stacks.synth();
