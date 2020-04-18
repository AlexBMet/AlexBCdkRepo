import {App} from '@aws-cdk/core';
import {DeploymentPipeline} from './deployment-pipeline';
import {DynamodbTable} from './dynamodb-table';
import {CrossAccountBucket} from './s3-bucket';
import {TypescriptLambda} from './typescript-lambda';

const stacks = new App();

new CrossAccountBucket(stacks, 'CrossAccountBucket', {});

new TypescriptLambda(stacks, 'TypeScriptLambda', {});

new DynamodbTable(stacks, 'DynamoDbTable', {});

new DeploymentPipeline(stacks, 'DeploymentPipeline', {});

stacks.synth();
