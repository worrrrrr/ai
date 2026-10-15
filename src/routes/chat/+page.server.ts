import { createLogger } from '#lib/server/log.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { ChatRow } from '#lib/server/chats.ts';

export const load = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('chats')
		.select('id, title, updated_at')
		.eq('owner_id', locals.user?.id ?? '')
		.is('deleted_at', null)
		.order('updated_at', { ascending: false })
		.limit(100);

	if (error) createLogger().write('error', 'โหลดรายการแชทไม่สำเร็จ', { reason: error.message });

	return { chats: (data ?? []) as ChatRow[] };
};

export const actions = {
	rename: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) redirect(303, '/auth');

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const title = String(form.get('title') ?? '').trim();

		if (!id) return fail(400, { message: 'ไม่พบแชทที่ต้องการเปลี่ยนชื่อ' });
		if (!title) return fail(400, { message: 'ชื่อแชทต้องไม่ว่าง' });

		// กรอง owner_id ไว้ด้วย แม้ RLS จะกรองให้แล้ว (ฐานข้อมูลจริงเจ้าของคือ owner_id ไม่ใช่ user_id)
		const { error } = await locals.supabase
			.from('chats')
			.update({ title: title.slice(0, 120) })
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });

		return { renamed: id };
	},

	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) redirect(303, '/auth');

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบแชทที่ต้องการลบ' });

		// ตารางจริงมีคอลัมน์ deleted_at -> ลบแบบเก็บประวัติ (ข้อความยังอยู่ ไม่หายถาวร)
		const { error } = await locals.supabase
			.from('chats')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });

		return { deleted: id };
	}
};
