import * as cdk from "@aws-cdk/core";
import {CfnParametersCode, Code, Function, Runtime} from "@aws-cdk/aws-lambda";

export interface LambdaStackProps extends cdk.StackProps {
    readonly instanceId: string;
}

export class LambdaStack extends cdk.Stack {

    public readonly helloWorldLambdaCode: CfnParametersCode;

    constructor(scope: cdk.Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        this.helloWorldLambdaCode = Code.fromCfnParameters();
        this.buildEventTriggeredLambdaFunction("HelloLambda", props.instanceId ,this.helloWorldLambdaCode);
    }

    private buildEventTriggeredLambdaFunction(name: string, instanceId: string, lambdaCode: CfnParametersCode): Function {
        const lambdaFn = this.buildLambdaFunction(`${name}Function`, "app", lambdaCode, instanceId);
        return lambdaFn;
    }

    private buildLambdaFunction(id: string, filename: string, code: CfnParametersCode, instanceId: string): Function {
        return new Function(this, id, {
            code: code,
            handler: filename + '.lambdaHandler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(300),
            runtime: Runtime.NODEJS_12_X,
            environment: {
                INSTANCE_IDENTIFIER: instanceId
            }
        });
    }
}
