import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {TypescriptLambda} from './typescript-lambda';

describe('[typescript-lambda.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create an lambda function', async () => {
			const stack = new TypescriptLambda(new Stack(), 'TypescriptLambda', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
