import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { ensureProfile } from '#lib/server/profiles.ts';
import { envProviders } from '#lib/server/providerEnv.ts';

import { agentInputSchema } from '#lib/server/agentSchema.ts';

function readAgentForm(form: FormData) {
	return {
		name: String(form.get('name') ?? '').trim(),
		description: String(form.get('description') ?? '').trim(),
		model: String(form.get('model') ?? '').trim(),
		providerId: String(form.get('provider_id') ?? '').trim(),
		systemPrompt: String(form.get('system_prompt') ?? '').trim(),
		temperature: String(form.get('temperature') ?? '')
	};
}

function columns(input: z.infer<typeof agentInputSchema>) {
	return {
		name: input.name,
		description: input.description || null,
		model: input.model,
		provider_id: input.providerId || null,
		system_prompt: input.systemPrompt || null,
		temperature: input.temperature
	};
}

export const load = async ({ locals, platform }) => {
	const userId = locals.user?.id ?? '';

	const [agents, providers] = await Promise.all([
		locals.supabase
			.from('agents')
			.select('*')
			.eq('owner_id', userId)
			.is('deleted_at', null)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('provider_credentials')
			.select('id, label, models')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
	]);

	return {
		agents: agents.data ?? [],
		// รวมผู้ให้บริการจาก .env (id ขึ้นต้น env:) เข้ากับของในฐานข้อมูล — ผู้ใช้เลือกใช้ได้เท่ากัน
		providers: [
			...(providers.data ?? []),
			...envProviders(platform?.env as Record<string, string | undefined> | undefined).map(
				(provider) => ({ id: provider.id, label: provider.label, models: [provider.model] })
			)
		],
		listError: agents.error?.message ?? providers.error?.message ?? null
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = agentInputSchema.safeParse(readAgentForm(await request.formData()));
		if (!parsed.success)
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });

		const profileError = await ensureProfile(locals.supabase, user);
		if (profileError) return fail(500, { message: profileError });

		const { error } = await locals.supabase
			.from('agents')
			.insert({ owner_id: user.id, ...columns(parsed.data) });

		if (error) return fail(500, { message: error.message });
		return { ok: `สร้างเอเจนต์ “${parsed.data.name}” แล้ว` };
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบเอเจนต์ที่ต้องการแก้' });

		const parsed = agentInputSchema.safeParse(readAgentForm(form));
		if (!parsed.success)
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });

		const { error } = await locals.supabase
			.from('agents')
			.update(columns(parsed.data))
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });
		return { ok: `บันทึกเอเจนต์ “${parsed.data.name}” แล้ว` };
	},

	/** ลบแบบเก็บประวัติ (ตารางจริงมี deleted_at) */
	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบเอเจนต์ที่ต้องการลบ' });

		const { error } = await locals.supabase
			.from('agents')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });
		return { ok: 'ลบเอเจนต์แล้ว (เก็บประวัติไว้)' };
	}
};
