import { DeploymentPipeline } from './deployment-pipeline';
import {App} from '@aws-cdk/core';
import {CrossAccountBucket} from './s3-bucket';

const app = new App();

new DeploymentPipeline(app, 'DeploymentPipeline', {
});

new CrossAccountBucket(app, 'CrossAccountBucket', {

});

app.synth();
