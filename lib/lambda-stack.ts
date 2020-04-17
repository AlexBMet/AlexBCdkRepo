import {Construct, Duration, PhysicalName, Stack, StackProps} from "@aws-cdk/core";
import {CfnParametersCode, Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";


export interface LambdaStackProps extends StackProps {
    readonly instanceId: string;
}

export class LambdaStack extends Stack {

    public readonly helloWorldLambdaCode: CfnParametersCode;
    public readonly deployActionRole: iam.Role;

    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        this.helloWorldLambdaCode = Code.fromCfnParameters();
        this.buildEventTriggeredLambdaFunction("HelloLambda", props.instanceId ,this.helloWorldLambdaCode);
        this.deployActionRole = new iam.Role(this, 'ActionRole', {
            assumedBy: new iam.AccountPrincipal('835146719373'), //pipeline account
            // the role has to have a physical name set
            roleName: 'DeployActionRole',
        });

    }

        // repoRole.addToPolicy(new PolicyStatement()
        //     .addAllResources()
        //     .addActions('s3:*', 'codecommit:*', 'kms:*'));
        // const repoRoleArn = `arn:aws:iam::${repoAcc}:role/CrossAccountRole`;

    private buildEventTriggeredLambdaFunction(name: string, instanceId: string, lambdaCode: CfnParametersCode): Function {
        const lambdaFn = this.buildLambdaFunction(`${name}Function`, "index", lambdaCode, instanceId);
        return lambdaFn;
    }

    private buildLambdaFunction(id: string, filename: string, code: CfnParametersCode, instanceId: string): Function {
        return new Function(this, id, {
            code: code,
            handler: filename + '.handler',
            memorySize: 128,
            timeout: Duration.seconds(300),
            runtime: Runtime.NODEJS_10_X,
            environment: {
                INSTANCE_IDENTIFIER: instanceId
            }
        });
    }
}
