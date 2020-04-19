import {SynthUtils} from '@aws-cdk/assert'; // tslint:disable-line:no-implicit-dependencies
import {Stack} from '@aws-cdk/core';
import {APILayer} from './api-layer';

describe('[api-layer.ts] unit tests', () => {

	describe('[stack]', () => {
		it('must create an lambda function', async () => {
			const stack = new APILayer(new Stack(), 'APILayerStack', {});
			expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
		});
	});
});
