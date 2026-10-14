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
	},

	rename: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth');

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const title = String(form.get('title') ?? '').trim();

		if (!id) return fail(400, { message: 'ไม่พบแชทที่ต้องการเปลี่ยนชื่อ' });
		if (!title) return fail(400, { message: 'ชื่อแชทต้องไม่ว่าง' });

		// RLS จำกัดให้แก้ได้เฉพาะแถวของผู้ใช้เองอยู่แล้ว
		const { error } = await locals.supabase
			.from('chats')
			.update({ title: title.slice(0, 120) })
			.eq('id', id);

		if (error) return fail(500, { message: error.message });

		return { renamed: id };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth');

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบแชทที่ต้องการลบ' });

		// messages ถูกลบตามด้วย foreign key on delete cascade
		const { error } = await locals.supabase.from('chats').delete().eq('id', id);
		if (error) return fail(500, { message: error.message });

		return { deleted: id };
	}
};
