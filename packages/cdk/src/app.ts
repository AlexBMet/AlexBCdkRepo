import {DeploymentPipeline} from './deployment-pipeline';
import {App} from '@aws-cdk/core';
import {CrossAccountBucket} from './s3-bucket';
import {TypescriptLambda} from './typescript-lambda';
import {DynamodbTable} from './dynamodb-table';

const app = new App();

new CrossAccountBucket(app, 'CrossAccountBucket', {});

new TypescriptLambda(app, 'TypeScriptLambda', {});

new DynamodbTable(app, 'DynamoDbTable', {});

new DeploymentPipeline(app, 'DeploymentPipeline', {});

app.synth();
