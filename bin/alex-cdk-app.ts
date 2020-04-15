#!/usr/bin/env node
import { AlexCdkAppStack } from '../lib/alex-cdk-app-stack';
import {LambdaStack} from "../lib/lambda-stack";
import {App} from "@aws-cdk/core";

const app = new App();

//NSWWS Account ids

const mgmtAccountId = '835146719373'; //mgmt
const devAccountId = '080660350717'; //dev
const region = 'eu-west-1';

const lambdaStack = new LambdaStack(app, 'LambdaStackId', {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
    },
    instanceId: "123",
});

new AlexCdkAppStack(app, 'AlexCdkAppStackId', {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
    },
    helloWorldLambdaCode: lambdaStack.helloWorldLambdaCode,
});

app.synth();