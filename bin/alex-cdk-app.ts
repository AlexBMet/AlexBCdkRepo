#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AlexCdkAppStack } from '../lib/alex-cdk-app-stack';
import {LambdaStack} from "../lib/lambda-stack";

const app = new cdk.App();

//const lambdaStack = new LambdaStack(app, 'LambdaStackId');
new AlexCdkAppStack(app, 'AlexCdkAppStackId', {
    //lambdaCode: lambdaStack.lambdaCode,
    env: {account: '879552525854' , region: 'eu-west-1'}
});

app.synth();