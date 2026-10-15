import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';

import { projectInputSchema } from '#lib/server/projectSchema.ts';

export const load = async ({ params, locals }) => {
	const userId = locals.user?.id ?? '';

	const { data: project } = await locals.supabase
		.from('projects')
		.select('*')
		.eq('id', params.id)
		.eq('owner_id', userId)
		.is('deleted_at', null)
		.maybeSingle();

	if (!project) error(404, 'ไม่พบโปรเจกต์นี้');

	const [chats, files] = await Promise.all([
		locals.supabase
			.from('chats')
			.select('id, title, updated_at')
			.eq('project_id', project.id)
			.eq('owner_id', userId)
			.is('deleted_at', null)
			.order('updated_at', { ascending: false }),
		locals.supabase
			.from('project_files')
			.select('id, name, url, type, size, created_at')
			.eq('project_id', project.id)
			.order('created_at', { ascending: false })
	]);

	return { project, chats: chats.data ?? [], files: files.data ?? [] };
};

export const actions = {
	update: async ({ request, params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const parsed = projectInputSchema.safeParse({
			name: String(form.get('name') ?? '').trim(),
			description: String(form.get('description') ?? '').trim(),
			icon: String(form.get('icon') ?? '').trim(),
			instructions: String(form.get('instructions') ?? '').trim()
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
		}

		const { error: updateError } = await locals.supabase
			.from('projects')
			.update({
				name: parsed.data.name,
				description: parsed.data.description || null,
				icon: parsed.data.icon || null,
				instructions: parsed.data.instructions || null
			})
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (updateError) return fail(500, { message: updateError.message });
		return { ok: `บันทึกโปรเจกต์ “${parsed.data.name}” แล้ว` };
	},

	delete: async ({ params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const { error: deleteError } = await locals.supabase
			.from('projects')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (deleteError) return fail(500, { message: deleteError.message });
		redirect(303, '/project');
	}
};
