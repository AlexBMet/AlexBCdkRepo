import * as cdk from "@aws-cdk/core";
import {CfnParametersCode} from "@aws-cdk/aws-lambda";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {
  CloudFormationCreateUpdateStackAction,
  CodeBuildAction,
  GitHubSourceAction
} from "@aws-cdk/aws-codepipeline-actions";
import {BuildSpec, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {AccountPrincipal, Effect, PolicyStatement, Role} from "@aws-cdk/aws-iam";
import {PhysicalName} from "@aws-cdk/core";
import {LambdaStack} from "./lambda-stack";

export interface PipelineStackProps extends cdk.StackProps {
  readonly helloWorldLambdaCode: CfnParametersCode;
  readonly deployAccount?: string;
  //readonly deployActionRole: Role;
  //readonly deploymentRoleArn?: string;
}

export class BuildPipeline extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Source action
    const oauthToken = cdk.SecretValue.secretsManager('GitHubToken');

    const sourceOutput = new Artifact("SourceOutput");
    const sourceAction = new GitHubSourceAction({
      actionName: 'Source',
      owner: 'AlexBMet',
      repo: 'AlexBCdkRepo',
      branch: 'master',
      oauthToken: oauthToken,
      output: sourceOutput,
    });

    // Build actions
    const lambdaTemplateFileName = 'LambdaStack.template.json';
    const cdkBuild = this.createCDKBuildProject('CdkBuild', lambdaTemplateFileName);

    const cdkBuildOutput = new Artifact('CdkBuildOutput');
    const cdkBuildAction = new CodeBuildAction({
      actionName: 'CDK_Build',
      project: cdkBuild,
      input: sourceOutput,
      outputs: [cdkBuildOutput],
    });

    const helloWorldLambdaBuild = this.createLambdaBuildProject('HelloWorldLambdaBuild', 'lambda');
    const helloWorldLambdaBuildOutput = new Artifact('HelloWorldLambdaBuildOutput');
    const helloWorldLambdaBuildAction = new CodeBuildAction({
      actionName: 'Hello_World_Lambda_Build',
      project: helloWorldLambdaBuild,
      input: sourceOutput,
      outputs: [helloWorldLambdaBuildOutput],
    });

    // Dev deployment action
    const deployToDevAction = new CloudFormationCreateUpdateStackAction({
      actionName: 'Lambda_Deploy_To_Dev',
      templatePath: cdkBuildOutput.atPath(lambdaTemplateFileName),
      stackName: 'AlexLambdaDeploymentStack',
      adminPermissions: true,
      parameterOverrides: {
        ...props.helloWorldLambdaCode.assign(helloWorldLambdaBuildOutput.s3Location),
      },
      extraInputs: [helloWorldLambdaBuildOutput]
    });


    // Construct the pipeline
    const pipelineName = "alex-cdk-pipeline";
    const pipeline = new Pipeline(this, pipelineName, {
      pipelineName: pipelineName,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [ helloWorldLambdaBuildAction, cdkBuildAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployToDevAction],
        }
      ]
    });

    // Make sure the deployment role can get the artifacts from the S3 bucket
    pipeline.artifactBucket.grantRead(deployToDevAction.deploymentRole);
  }

  private createCDKBuildProject(id: string, templateFilename: string) {
    return new PipelineProject(this, id, {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              "npm install",
              "npm install -g cdk",
              "npm install -g typescript",
            ],
          },
          build: {
            commands: [
              'npm run build',
              'npm run cdk synth -- -o dist'
            ],
          },
        },
        artifacts: {
          'base-directory': 'dist',
          files: [
            templateFilename,
          ],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_2_0,
        //privileged: true
      },
    });
  }

  private createLambdaBuildProject(id: string, sourceCodeBaseDirectory: string) {
    return new PipelineProject(this, id, {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
          phases: {
            install: {
                'runtime-versions': {
                    'nodejs': 10,
                },
              commands: [
                'ls',
              ],
            },
          },
        artifacts: {
          'base-directory': sourceCodeBaseDirectory,
          files: [
             'index.js',
          ]
        }
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_2_0,
      },
    })
  }
}
