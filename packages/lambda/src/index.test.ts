import {handler} from './index';

describe('[index.js] unit tests', () => {

	beforeEach(() => {
		jest.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	describe('[handler]', () => {
		it('must respond with "FU BAR"', async () => {
			expect(await handler()).toEqual('FU BAR');
			expect(console.info).toHaveBeenCalledWith('FU BAR');
		});
	});
});
