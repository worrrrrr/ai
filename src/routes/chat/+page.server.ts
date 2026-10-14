import { fail, redirect } from '@sveltejs/kit';
import type { ChatRow } from '#lib/server/chats.ts';

export const load = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('chats')
		.select('id, title, updated_at')
		.order('updated_at', { ascending: false })
		.limit(100);

	if (error) console.error('[chat] list failed:', error.message);

	return { chats: (data ?? []) as ChatRow[] };
};

export const actions = {
	new: async ({ locals }) => {
		const user = locals.user;
		if (!user) redirect(303, '/auth');

		const { data, error } = await locals.supabase
			.from('chats')
			.insert({ id: crypto.randomUUID(), user_id: user.id, title: 'แชทใหม่' })
			.select('id')
			.single();

		if (error || !data) {
			return fail(500, { message: error?.message ?? 'สร้างแชทไม่สำเร็จ' });
		}

		redirect(303, `/chat/${data.id}`);
	}
};
