export const load = async ({ url }) => {
	const reason = url.searchParams.get('reason') ?? 'unknown';
	return { reason: reason.slice(0, 300) };
};
