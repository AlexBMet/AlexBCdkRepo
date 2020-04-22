import { TAGS } from './tags';

describe('[tags.ts] unit tests', () => {
	describe('[ServiceCode]', () => {
		it('must be "SFWRMC"', async () => {
			expect(TAGS.ServiceCode).toEqual('SFWRMC');
		});
	});

	describe('[ServiceName]', () => {
		it('must be "NSWWS Sign Up"', async () => {
			expect(TAGS.ServiceName).toEqual('NSWWS Sign Up');
		});
	});

	describe('[ServiceOwner]', () => {
		it('must be "aws-nswws-dis-business@metoffice.gov.uk"', async () => {
			expect(TAGS.ServiceOwner).toEqual('aws-nswws-dis-business@metoffice.gov.uk');
		});
	});
});
