import { BuildPipeline } from './build-pipeline';
import {App} from '@aws-cdk/core';

const app = new App();

new BuildPipeline(app, 'DeploymentPipeline', {
});

app.synth();
