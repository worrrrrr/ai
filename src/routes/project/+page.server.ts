import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { ensureProfile } from '#lib/server/profiles.ts';

/** ช่องที่หน้า /project รับจากฟอร์ม (ตรงกับคอลัมน์จริงของตาราง projects) */
import { projectInputSchema } from '#lib/server/projectSchema.ts';

function readProjectForm(form: FormData) {
	return {
		name: String(form.get('name') ?? '').trim(),
		description: String(form.get('description') ?? '').trim(),
		icon: String(form.get('icon') ?? '').trim(),
		instructions: String(form.get('instructions') ?? '').trim()
	};
}

function columns(input: z.infer<typeof projectInputSchema>) {
	return {
		name: input.name,
		description: input.description || null,
		icon: input.icon || null,
		instructions: input.instructions || null
	};
}

export const load = async ({ locals }) => {
	const userId = locals.user?.id ?? '';

	const [projects, chats] = await Promise.all([
		locals.supabase
			.from('projects')
			.select('*')
			.eq('owner_id', userId)
			.is('deleted_at', null)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('chats')
			.select('id, project_id')
			.eq('owner_id', userId)
			.is('deleted_at', null)
	]);

	// นับแชทต่อโปรเจกต์ (ยิงครั้งเดียวแล้วจัดกลุ่มในหน่วยความจำ)
	const counts = new Map<string, number>();
	for (const chat of chats.data ?? []) {
		if (!chat.project_id) continue;
		counts.set(chat.project_id, (counts.get(chat.project_id) ?? 0) + 1);
	}

	return {
		projects: projects.data ?? [],
		chatCounts: Object.fromEntries(counts),
		listError: projects.error?.message ?? chats.error?.message ?? null
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = projectInputSchema.safeParse(readProjectForm(await request.formData()));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
		}

		const profileError = await ensureProfile(locals.supabase, user);
		if (profileError) return fail(500, { message: profileError });

		const { error } = await locals.supabase
			.from('projects')
			.insert({ owner_id: user.id, ...columns(parsed.data) });

		if (error) return fail(500, { message: error.message });
		return { ok: `สร้างโปรเจกต์ “${parsed.data.name}” แล้ว` };
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบโปรเจกต์ที่ต้องการแก้' });

		const parsed = projectInputSchema.safeParse(readProjectForm(form));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
		}

		const { error } = await locals.supabase
			.from('projects')
			.update(columns(parsed.data))
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });
		return { ok: `บันทึกโปรเจกต์ “${parsed.data.name}” แล้ว` };
	},

	/** ลบแบบเก็บประวัติ (ตารางจริงมี deleted_at) — แชทในโปรเจกต์ไม่ถูกลบ */
	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบโปรเจกต์ที่ต้องการลบ' });

		const { error } = await locals.supabase
			.from('projects')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id)
			.eq('owner_id', user.id);

		if (error) return fail(500, { message: error.message });
		return { ok: 'ลบโปรเจกต์แล้ว (ตัวแชทไม่ได้ถูกลบ)' };
	}
};
