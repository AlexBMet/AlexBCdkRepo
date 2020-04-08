import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as lambda from '@aws-cdk/aws-lambda';
import {App, Stack, StackProps, SecretValue} from '@aws-cdk/core';

// export interface PipelineStackProps extends StackProps {
//   readonly lambdaCode: lambda.CfnParametersCode;
// }

export class AlexCdkAppStack extends Stack {
//  constructor(app: App, id: string, props: PipelineStackProps) {
    constructor(app: App, id: string, props: StackProps) {
    super(app, id, props);

    const cdkBuild = new codebuild.PipelineProject(this, 'CdkBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: 'npm install',
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
            'LambdaStack.template.json',
          ],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
      },
    });
    // const lambdaBuild = new codebuild.PipelineProject(this, 'LambdaBuild', {
    //   buildSpec: codebuild.BuildSpec.fromObject({
    //     version: '0.2',
    //     phases: {
    //       install: {
    //         commands: [
    //           'cd lambda',
    //           'npm install',
    //         ],
    //       },
    //       // build: {
    //       //   commands: 'npm run build',
    //       // },
    //     },
    //     artifacts: {
    //       'base-directory': 'lambda',
    //       files: [
    //         'index.js',
    //         'node_modules/**/*',
    //       ],
    //     },
    //   }),
    //   environment: {
    //     buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
    //   },
    // });

    const sourceOutput = new codepipeline.Artifact();
    const cdkBuildOutput = new codepipeline.Artifact('CdkBuildOutput');
    //const lambdaBuildOutput = new codepipeline.Artifact('LambdaBuildOutput');

    // new codebuild.GitHubSourceCredentials(this, 'CodeBuildGitHubCreds', {
    //   accessToken: cdk.SecretValue.secretsManager('my-token'),
    // });

    //Connecting github to code pipeline for the first time
    //https://github.com/aws/aws-cdk/issues/3515

    // Read the secret from Secrets Manager
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: 'AlexBMet',
      repo: 'AlexBCdkRepo',
      oauthToken: SecretValue.secretsManager('/alexcdk/secrets/github/token', { jsonField : "alex-cdk-github-token"} ),
      output: sourceOutput,
      branch: 'master',
      //variablesNamespace: 'AlexCdkNamespace',
      trigger: codepipeline_actions.GitHubTrigger.POLL // default: 'WEBHOOK', 'NONE' is also possible for no Source trigger
      // webhook: true, // optional, default: true if `webhookFilteres` were provided, false otherwise
      // webhookFilters: [
      //   codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs('master'),
      // ], // optional, by default all pushes and Pull Requests will trigger a build

      //Command line source creds
      //aws codebuild import-source-credentials --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token <token_value>

    });


    new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            sourceAction,
          ],
        },
        {
          stageName: 'Build',
          actions: [
            // new codepipeline_actions.CodeBuildAction({
            //   actionName: 'Lambda_Build',
            //   project: lambdaBuild,
            //   input: sourceOutput,
            //   outputs: [lambdaBuildOutput],
            // }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'CDK_Build',
              project: cdkBuild,
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        },
        // {
        //   stageName: 'Deploy',
        //   actions: [
        //     new codepipeline_actions.CloudFormationCreateUpdateStackAction({
        //       actionName: 'Lambda_CFN_Deploy',
        //       templatePath: cdkBuildOutput.atPath('LambdaStack.template.json'),
        //       stackName: 'LambdaDeploymentStack',
        //       adminPermissions: true,
        //       parameterOverrides: {
        //         ...props.lambdaCode.assign(lambdaBuildOutput.s3Location),
        //       },
        //       extraInputs: [lambdaBuildOutput],
        //     }),
        //   ],
        // },
      ],
    });
  }
}
