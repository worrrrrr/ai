import { fail } from '@sveltejs/kit';
import { ensureProfile } from '#lib/server/profiles.ts';
import { LAYOUT_COOKIE, THEME_COOKIE, serializeLayoutCookie } from '#lib/settings.ts';
import {
	clearUserSettings,
	issueMessages,
	layoutInputSchema,
	readLayoutForm,
	saveUserSettings,
	settingsDb
} from '#lib/server/settings.ts';

// theme ต้องเป็นคุกกี้ที่ JavaScript อ่านได้ เพราะ app.html ใช้ตั้งธีมก่อน paint
const COOKIE_OPTIONS = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' } as const;

export const actions = {
	save: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = layoutInputSchema.safeParse(readLayoutForm(await request.formData()));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const values = parsed.data;

		// คุกกี้ = ค่าที่มีผลทันทีในเบราว์เซอร์นี้ (อ่านก่อน paint ทุกครั้งที่โหลดหน้า)
		cookies.set(THEME_COOKIE, values.theme, COOKIE_OPTIONS);
		cookies.set(LAYOUT_COOKIE, serializeLayoutCookie(values), COOKIE_OPTIONS);

		// ตาราง user_settings = สำเนาถาวรที่ติดไปทุกเครื่อง
		const profileError = await ensureProfile(locals.supabase, user);
		if (profileError) return fail(500, { message: profileError });

		const { error } = await saveUserSettings(settingsDb(locals.supabase), user.id, values);
		if (error) {
			return { ok: 'บันทึกในเบราว์เซอร์นี้แล้ว — มีผลทันที', warning: error };
		}

		return { ok: 'บันทึกแล้ว — ค่านี้มีผลกับทุกหน้าจอและทุกเครื่องที่ล็อกอิน' };
	},

	reset: async ({ locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		cookies.delete(THEME_COOKIE, { path: '/' });
		cookies.delete(LAYOUT_COOKIE, { path: '/' });

		const { error } = await clearUserSettings(settingsDb(locals.supabase), user.id);
		if (error) return { ok: 'ล้างค่าในเบราว์เซอร์นี้แล้ว', warning: error };

		return { ok: 'กลับไปใช้ค่าตั้งต้นของโปรเจกต์แล้ว' };
	}
};
