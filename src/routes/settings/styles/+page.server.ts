import { fail } from '@sveltejs/kit';
import {
	activeChoicesFromRow,
	applyStyleTemplate,
	createStyle,
	deleteStyle,
	issueMessages,
	listStyles,
	loadUserSettings,
	readStyleForm,
	setActiveChoice,
	settingsDb,
	styleInputSchema,
	stylePresetFromRow,
	updateStyle
} from '#lib/server/settings.ts';
import { styleTemplates, templateValues } from '#lib/stylePresets.ts';

export const load = async ({ locals }) => {
	const userId = locals.user?.id ?? '';
	const db = settingsDb(locals.supabase);

	const [styles, stored] = await Promise.all([
		listStyles(db, userId),
		loadUserSettings(db, userId)
	]);
	const choices = activeChoicesFromRow(stored.row);

	return {
		// ส่งเป็น StylePreset ที่ผ่านการตรวจค่าแล้ว -> component ใช้ได้ตรง ๆ (ผิดค่าจะถูกแทนด้วยค่าตั้งต้น)
		styles: styles.rows.map((row) => stylePresetFromRow(row, row.id === choices.styleId)),
		listError: styles.error,
		choices,
		templates: styleTemplates
	};
};

/** ตั้งสไตล์ที่ใช้อยู่ (คืนข้อความ error ถ้าทำไม่ได้) */
async function activateStyle(
	db: ReturnType<typeof settingsDb>,
	userId: string,
	id: string | null
): Promise<string | null> {
	const { error } = await setActiveChoice(db, userId, 'style_id', id);
	return error;
}

/**
 * อ่านค่ากลับมาตรวจว่า "สไตล์ที่ใช้อยู่" ถูกบันทึกจริง
 * กันกรณีที่ระบบตอบสำเร็จแต่แอปไม่เปลี่ยน (เช่น RLS ไม่ให้เขียน หรือ id ที่ได้ไม่ถูกต้อง)
 */
async function verifyActiveStyle(
	db: ReturnType<typeof settingsDb>,
	userId: string,
	expected: string | null
): Promise<string | null> {
	const { row, error } = await loadUserSettings(db, userId);
	if (error) return error;

	if (row?.style_id !== expected) {
		return `บันทึกแล้วแต่ค่าที่อ่านกลับมาไม่ตรง (คาดว่า ${expected ?? 'null'} · ได้ ${row?.style_id ?? 'null'}) — ตรวจสิทธิ์ (RLS) ของตาราง user_settings`;
	}

	return null;
}

export const actions = {
	/** ใช้แม่แบบจากโค้ด: คัดลอกค่าลงตาราง `styles` ของผู้ใช้แล้วตั้งเป็นสไตล์ที่ใช้อยู่ (กดซ้ำได้) */
	apply: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const templateId = String((await request.formData()).get('template') ?? '');
		const template = styleTemplates.find((item) => item.id === templateId);
		if (!template) return fail(400, { message: 'ไม่พบแม่แบบที่เลือก' });

		const db = settingsDb(locals.supabase);
		const saved = await applyStyleTemplate(db, user.id, template.name, templateValues(template));
		if (saved.error) return fail(500, { message: saved.error });

		const error = await activateStyle(db, user.id, saved.id);
		if (error) return fail(500, { message: error });

		const mismatch = await verifyActiveStyle(db, user.id, saved.id);
		if (mismatch) return fail(500, { message: mismatch });

		return { ok: `ใช้สไตล์ “${template.name}” แล้ว — มีผลทั้งแอปทันที` };
	},

	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = styleInputSchema.safeParse(readStyleForm(await request.formData()));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const db = settingsDb(locals.supabase);
		const created = await createStyle(db, user.id, parsed.data);
		if (created.error) return fail(500, { message: created.error });

		if (created.id) {
			const error = await activateStyle(db, user.id, created.id);
			if (error) return fail(500, { message: error });

			const mismatch = await verifyActiveStyle(db, user.id, created.id);
			if (mismatch) return fail(500, { message: mismatch });
		}

		return { ok: `สร้างสไตล์ “${parsed.data.name}” แล้ว และตั้งเป็นสไตล์ที่ใช้อยู่` };
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบสไตล์ที่ต้องการแก้' });

		const parsed = styleInputSchema.safeParse(readStyleForm(form));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const { error } = await updateStyle(settingsDb(locals.supabase), user.id, id, parsed.data);
		if (error) return fail(500, { message: error });

		return { ok: `บันทึกสไตล์ “${parsed.data.name}” แล้ว` };
	},

	use: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบสไตล์ที่เลือก' });

		const error = await activateStyle(settingsDb(locals.supabase), user.id, id);
		if (error) return fail(500, { message: error });

		const mismatch = await verifyActiveStyle(settingsDb(locals.supabase), user.id, id);
		if (mismatch) return fail(500, { message: mismatch });

		return { ok: 'ตั้งเป็นสไตล์ที่ใช้อยู่แล้ว' };
	},

	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบสไตล์ที่ต้องการลบ' });

		const db = settingsDb(locals.supabase);
		const stored = await loadUserSettings(db, user.id);

		const { error } = await deleteStyle(db, user.id, id);
		if (error) return fail(500, { message: error });

		// ถ้าลบสไตล์ที่ใช้อยู่ FK on delete set null จะล้าง style_id ให้ แต่ล้างซ้ำให้ชัดเจน
		if (stored.row?.style_id === id) {
			const cleared = await activateStyle(db, user.id, null);
			if (cleared) return fail(500, { message: cleared });
		}

		return { ok: 'ลบสไตล์แล้ว' };
	}
};
