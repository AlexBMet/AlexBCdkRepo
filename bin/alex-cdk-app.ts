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

const lambdaCode = lambdaStack.helloWorldLambdaCode;
const deployActionRole = lambdaStack.deployActionRole;

new BuildPipeline(app, 'PipelineStack', {
    env: buildAccount,
    deployAccount: devAccountId,
    deployActionRole: deployActionRole,
    helloWorldLambdaCode: lambdaCode,
});

//Passing params into stack but not best practice
//app.node.tryGetContext()

app.synth();


//Deploy stuff
//
// source ${WORKSPACE}/tools/build/scripts/assumeRole.sh \"${REGION}\" \"${targetEnv}\" \"${WORKSPACE}\" > /dev/null
// cdk deploy '${PREFIX}*' --context=ENVIRONMENT=${targetEnv} --require-approval never

//https://github.com/MetOffice/consumer-digital-platform/blob/develop/tools/build/scripts/assumeRole.sh

// #!/usr/bin/env bash
//
// set -uxo
//
// USAGE_STRING="Usage ./assumeRole.sh <aws region> <env> <workspace> optional<aws iam role> optional<timeout_seconds>\nTimeout must be specified with IAM role or 'default'"
//
// if [[ $# -lt 3 ]] ; then
// echo ${USAGE_STRING}
// exit 1
// fi
//
// declare -A aws_accounts
// declare -A aws_roles
//
// DEV_ACCOUNT=$(awk -F " = " '/DevAccount/ {print $2}' ${3}/shared/config/config.ini)
// CI_ACCOUNT=$(awk -F " = " '/CiAccount/ {print $2}' ${3}/shared/config/config.ini)
// PRD_ACCOUNT=$(awk -F " = " '/PrdAccount/ {print $2}' ${3}/shared/config/config.ini)
//
// # Reference account numbers by environment (not account) name
// aws_accounts=( ["dev"]=${DEV_ACCOUNT} ["ci"]=${CI_ACCOUNT} ["prd"]=${PRD_ACCOUNT})
// aws_roles=( ["dev"]="PipelineAutomationRole" ["ci"]="PipelineAutomationRole" ["prd"]="PipelineAutomationRole" ["default"]="default")
//
// region=$1
// deployment_env=$2
// aws_iam_role=${4:-${aws_roles[${deployment_env}]}}
// if [[ ${aws_iam_role} == "default" ]] ; then
// aws_iam_role=${aws_roles[${deployment_env}]}
// fi
// timeout_seconds=${5:-3600}
//     aws_account=${aws_accounts[${deployment_env}]}
//
// role_session_name=jenkins-`date +%s`
// echo "assumeRole.sh is assuming role arn:aws:iam::${aws_account}:role/${aws_iam_role} with session name ${role_session_name}"
// echo "Silencing bash command output"
// set +x
//
// # Assume role
// assume_role=$(aws sts assume-role --duration-seconds ${timeout_seconds} --region "${region}" --role-arn arn:aws:iam::"${aws_account}":role/"${aws_iam_role}" --role-session-name "${role_session_name}")
// export AWS_ACCESS_KEY_ID=$(echo "${assume_role}" | jq -r '.Credentials.AccessKeyId')
// export AWS_SECRET_ACCESS_KEY=$(echo "${assume_role}" | jq -r '.Credentials.SecretAccessKey')
// export AWS_SESSION_TOKEN=$(echo "${assume_role}" | jq -r '.Credentials.SessionToken')
// export AWS_DEFAULT_REGION=${region}
//
//     echo "Success! Enabling command output"
// set -x