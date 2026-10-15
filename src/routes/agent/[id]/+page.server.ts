import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { envProviders } from '#lib/server/providerEnv.ts';

import { agentInputSchema } from '#lib/server/agentSchema.ts';

export const load = async ({ params, locals, platform }) => {
	const userId = locals.user?.id ?? '';

	const { data: agent } = await locals.supabase
		.from('agents')
		.select('*')
		.eq('id', params.id)
		.eq('owner_id', userId)
		.is('deleted_at', null)
		.maybeSingle();

	if (!agent) error(404, 'ไม่พบเอเจนต์นี้');

	const [links, providers] = await Promise.all([
		locals.supabase
			.from('chat_participants')
			.select('chat_id')
			.eq('participant_id', agent.id)
			.eq('participant_type', 'agent'),
		locals.supabase
			.from('provider_credentials')
			.select('id, label')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
	]);

	const chatIds = (links.data ?? []).map((row) => row.chat_id);
	const chats = chatIds.length
		? ((
				await locals.supabase
					.from('chats')
					.select('id, title, updated_at')
					.in('id', chatIds)
					.is('deleted_at', null)
					.order('updated_at', { ascending: false })
			).data ?? [])
		: [];

	return {
		agent,
		chats,
		// รวมผู้ให้บริการจาก .env (id ขึ้นต้น env:) ให้เลือกได้เหมือนตอนสร้าง
		providers: [
			...(providers.data ?? []),
			...envProviders(platform?.env as Record<string, string | undefined> | undefined).map(
				(provider) => ({ id: provider.id, label: provider.label })
			)
		]
	};
};

export const actions = {
	update: async ({ request, params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const parsed = agentInputSchema.safeParse({
			name: String(form.get('name') ?? '').trim(),
			description: String(form.get('description') ?? '').trim(),
			model: String(form.get('model') ?? '').trim(),
			providerId: String(form.get('provider_id') ?? '').trim(),
			systemPrompt: String(form.get('system_prompt') ?? '').trim(),
			temperature: String(form.get('temperature') ?? '')
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
		}

		const { error: updateError } = await locals.supabase
			.from('agents')
			.update({
				name: parsed.data.name,
				description: parsed.data.description || null,
				model: parsed.data.model,
				provider_id: parsed.data.providerId || null,
				system_prompt: parsed.data.systemPrompt || null,
				temperature: parsed.data.temperature
			})
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (updateError) return fail(500, { message: updateError.message });
		return { ok: `บันทึกเอเจนต์ “${parsed.data.name}” แล้ว` };
	},

	delete: async ({ params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const { error: deleteError } = await locals.supabase
			.from('agents')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (deleteError) return fail(500, { message: deleteError.message });
		redirect(303, '/agent');
	}
};
