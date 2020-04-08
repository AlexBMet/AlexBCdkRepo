#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AlexCdkAppStack } from '../lib/alex-cdk-app-stack';
import {LambdaStack} from "../lib/lambda-stack";

const app = new cdk.App();

const accountId = '835146719373';
const region = 'eu-west-1';

const lambdaStack = new LambdaStack(app, 'LambdaStackId', {
    env: {
        account: accountId,
        region: region
    },
    instanceId: "123",
});

new AlexCdkAppStack(app, 'AlexCdkAppStackId', {
    env: {
        account: accountId,
        region: region
    },
    helloWorldLambdaCode: lambdaStack.helloWorldLambdaCode,
});

app.synth();