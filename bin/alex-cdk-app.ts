#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AlexCdkAppStack } from '../lib/alex-cdk-app-stack';

const app = new cdk.App();
new AlexCdkAppStack(app, 'AlexCdkAppStack');
