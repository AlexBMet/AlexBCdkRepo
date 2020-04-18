import {DeploymentPipeline} from './deployment-pipeline';
import {App} from '@aws-cdk/core';
import {CrossAccountBucket} from './s3-bucket';
import {TypescriptLambda} from './typescript-lambda';

const app = new App();

new DeploymentPipeline(app, 'DeploymentPipeline', {});

new CrossAccountBucket(app, 'CrossAccountBucket', {});

new TypescriptLambda(app, 'TypeScriptLambda', {});

app.synth();
