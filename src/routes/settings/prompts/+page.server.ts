import { fail } from '@sveltejs/kit';
import {
	activeChoicesFromRow,
	createPrompt,
	issueMessages,
	listPrompts,
	loadUserSettings,
	promptInputSchema,
	readPromptForm,
	setActiveChoice,
	settingsDb,
	softDeletePrompt,
	updatePrompt
} from '#lib/server/settings.ts';

export const load = async ({ locals }) => {
	const userId = locals.user?.id ?? '';
	const db = settingsDb(locals.supabase);

	const [prompts, stored] = await Promise.all([
		listPrompts(db, userId),
		loadUserSettings(db, userId)
	]);

	return {
		prompts: prompts.rows,
		listError: prompts.error,
		choices: activeChoicesFromRow(stored.row)
	};
};

export const actions = {
	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = promptInputSchema.safeParse(readPromptForm(await request.formData()));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const db = settingsDb(locals.supabase);
		const created = await createPrompt(db, user.id, parsed.data);
		if (created.error) return fail(500, { message: created.error });

		// พรอมป์ที่สร้างใหม่กลายเป็นพรอมป์ที่ใช้อยู่ (ตารางจริงไม่มีคอลัมน์ default)
		if (created.id) {
			const active = await setActiveChoice(db, user.id, 'prompt_id', created.id);
			if (active.error) return fail(500, { message: active.error });
		}

		return { ok: `สร้างพรอมป์ “${parsed.data.title}” แล้ว และตั้งเป็นพรอมป์ที่ใช้อยู่` };
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบพรอมป์ที่ต้องการแก้' });

		const parsed = promptInputSchema.safeParse(readPromptForm(form));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const { error } = await updatePrompt(settingsDb(locals.supabase), user.id, id, parsed.data);
		if (error) return fail(500, { message: error });

		return { ok: `บันทึกพรอมป์ “${parsed.data.title}” แล้ว` };
	},

	use: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบพรอมป์ที่เลือก' });

		const { error } = await setActiveChoice(settingsDb(locals.supabase), user.id, 'prompt_id', id);
		if (error) return fail(500, { message: error });

		return { ok: 'ตั้งเป็นพรอมป์ที่ใช้อยู่แล้ว' };
	},

	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบพรอมป์ที่ต้องการลบ' });

		const db = settingsDb(locals.supabase);
		const stored = await loadUserSettings(db, user.id);

		// ตารางจริงมี deleted_at -> ลบแบบเก็บประวัติ
		const { error } = await softDeletePrompt(db, user.id, id);
		if (error) return fail(500, { message: error });

		if (stored.row?.prompt_id === id) {
			const cleared = await setActiveChoice(db, user.id, 'prompt_id', null);
			if (cleared.error) return fail(500, { message: cleared.error });
		}

		return { ok: 'ลบพรอมป์แล้ว (เก็บประวัติไว้ในฐานข้อมูล)' };
	}
};
