import * as codedeploy from '@aws-cdk/aws-codedeploy';
import * as lambda from '@aws-cdk/aws-lambda';
import { App, Stack, StackProps } from '@aws-cdk/core';

export class LambdaStack extends Stack {
    public readonly lambdaCode: lambda.CfnParametersCode;

    constructor(app: App, id: string, props?: StackProps) {
        super(app, id, props);

        this.lambdaCode = lambda.Code.fromCfnParameters();

        const func = new lambda.Function(this, 'Lambda', {
            code: this.lambdaCode,
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_10_X,
        });

        const version = func.addVersion(new Date().toISOString());
        const alias = new lambda.Alias(this, 'LambdaAlias', {
            aliasName: 'Prod',
            version,
        });

        new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
            alias,
            deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
        });
    }
}