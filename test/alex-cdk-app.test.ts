import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import AlexCdkApp = require('../lib/build-pipeline');

// test('SQS Queue Created', () => {
//     const app = new cdk.App();
//     // WHEN
//     const stack = new AlexCdkApp.BuildPipeline(app, 'MyTestStack');
//     // THEN
//     expectCDK(stack).to(haveResource("AWS::SQS::Queue",{
//       VisibilityTimeout: 300
//     }));
// });

// test('SNS Topic Created', () => {
//   const app = new cdk.App();
//   // WHEN
//   const stack = new AlexCdkApp.BuildPipeline(app, 'MyTestStack');
//   // THEN
//   expectCDK(stack).to(haveResource("AWS::SNS::Topic"));
// });
