export const generateResourcePrefix = (uniquePrefix: string, environment: string, region: string) => {
	return `${uniquePrefix}-${environment}-${region}`
};
