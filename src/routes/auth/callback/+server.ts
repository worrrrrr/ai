import { redirect, type RequestHandler } from '@sveltejs/kit';
import { safeInternalPath } from '#lib/server/redirects.ts';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = safeInternalPath(url.searchParams.get('next'));

	if (!code) {
		redirect(303, '/auth/auth-code-error?reason=missing_code');
	}

	const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

	if (error) {
		redirect(303, `/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`);
	}

	redirect(303, next);
};
