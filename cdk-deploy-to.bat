@echo off
rem cdk-deploy-to.bat
set CDK_DEPLOY_ACCOUNT=%1
shift
set CDK_DEPLOY_REGION=%1
shift
cdk deploy %*