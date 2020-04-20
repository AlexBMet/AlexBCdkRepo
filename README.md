<h1 align="center">Cross-account CDK Pipeline</h1>

<h4 align="center">Coming soon...</h4>

<p align="center">
  	<a href="#getting-started">Getting started</a> |
  	<a href="#how-to-use">How to use</a> 
</p>

## Getting started
### Overview
Coming soon...

### Pre-requisites
To clone and run this application, you'll need **[Git](https://git-scm.com)**, **[Node.js](https://nodejs.org/en/)**, 
**[Yarn](https://yarnpkg.com/lang/en/)** and the **[AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html)** installed on your computer.

## How to use
From your favourite command line tool, run the following:
```bash
# Clone the repo
$ git clone git@github.com:AlexBMet/AlexBCdkRepo.git

# Install dependencies
$ yarn
```

Create a .env file at the root of the **[CDK package](packages/cdk)** and add the following key-value pairs:
```.env
DEV_ACCOUNT=**Insert the ID of the DEV AWS account**
CI_ACCOUNT=**Insert the ID of the CI AWS account**
PROD_ACCOUNT=**Insert the ID of the PROD AWS account**
DEPLOYMENT_TYPE=**Insert the type of deployment mechanism, either feature | release**
SOURCE_BRANCH=**Insert the name of the git branch to deploy**
UNIQUE_PREFIX=**Insert a unique prefix for all AWS resources**
```

```bash
# Synthesize the deployment pipeline to deploy manually via the CloudFormation console
$ cdk synth DeploymentPipeline > template.yaml

# Deploy the deployment pipeline using the CDK
$ cdk deploy DeploymentPipeline --profile **Insert the name of your AWS profile**
```

