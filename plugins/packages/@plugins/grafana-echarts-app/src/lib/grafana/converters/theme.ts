export const convertThemePxToNumeric = (value: string) => {
	return Number.parseInt(value.slice(0, -2), 10);
};
