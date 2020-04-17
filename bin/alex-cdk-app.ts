#!/usr/bin/env node
import { BuildPipeline } from '../lib/build-pipeline';
import {LambdaStack} from "../lib/lambda-stack";
import {App} from "@aws-cdk/core";

const app = new App();

//NSWWS Account ids

const mgmtAccountId = '835146719373'; //mgmt
const devAccountId = '080660350717'; //dev
const region = 'eu-west-1';


const buildAccount = { account: "835146719373", region: region };
const devAccount = { account: "080660350717", region: region };

const lambdaStack = new LambdaStack(app, 'LambdaStack', {
    // env: {
    //     account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    //     region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
    // },

    env: buildAccount,

    instanceId: "123",
});

new BuildPipeline(app, 'PipelineStack', {
    // env: {
    //     account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    //     region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
    // },

    env: buildAccount,
    deployAccount: devAccountId,
    helloWorldLambdaCode: lambdaStack.helloWorldLambdaCode,
});

// new BuildPipelineStack(app, "BuildPipelineStack", {
//     env: buildAccount,
//     nonProd: nonProdAccount,
// });
// new ReactFrontEndStack(app, "NonProdReactFrontEndStack", { env: nonProdAccount });
// new ReactFrontEndStack(app, "ProdReactFrontEndStack", { env: ProdAccount });

//Passing params into stack but not best practice
//app.node.tryGetContext()

app.synth();