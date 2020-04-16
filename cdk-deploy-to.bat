@echo off
rem cdk-deploy-to.bat
set CDK_DEPLOY_ACCOUNT=%1
shift
set CDK_DEPLOY_REGION=%1
shift
ECHO Running CDK Deploy...
ECHO Account :%CDK_DEPLOY_ACCOUNT%
ECHO:Region: %CDK_DEPLOY_REGION%
cdk deploy -v PipelineStack*