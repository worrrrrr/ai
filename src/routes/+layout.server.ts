import type { ChatRow } from '#lib/server/chats.ts';
import {
	activeChoicesFromRow,
	loadStyle,
	loadUserSettings,
	settingsDb,
	stylePresetFromRow,
	userSettingsFromRow
} from '#lib/server/settings.ts';
import {
	LAYOUT_COOKIE,
	THEME_COOKIE,
	parseLayoutCookie,
	resolveUserSettings,
	type AppUser
} from '#lib/settings.ts';
import { createLogger } from '#lib/server/log.ts';

/** รายการแชทของ sidebar — ผู้ใช้ที่ยังไม่ยืนยันตัวตนไม่ต้องยิง query */
async function loadChats(
	locals: App.Locals,
	user: AppUser | null
): Promise<{ rows: ChatRow[]; error: string | null }> {
	if (!user) return { rows: [], error: null };

	// ฐานข้อมูลจริง: เจ้าของคือ owner_id และแชทที่ลบแล้วคือ deleted_at ไม่ใช่ null
	const { data, error } = await locals.supabase
		.from('chats')
		.select('id, title, updated_at')
		.eq('owner_id', user.id)
		.is('deleted_at', null)
		.order('updated_at', { ascending: false })
		.limit(50);

	if (error) return { rows: [], error: error.message };
	return { rows: (data ?? []) as ChatRow[], error: null };
}

export const load = async ({ locals, cookies }) => {
	const user: AppUser | null = locals.user
		? { id: locals.user.id, email: locals.user.email ?? null }
		: null;

	const db = settingsDb(locals.supabase);

	// ยิงพร้อมกันสองก้อนแรก (รายการแชท + ค่าที่ตั้งไว้) แล้วค่อยโหลด "สไตล์ที่ใช้อยู่"
	// เพราะต้องรู้ style_id จาก user_settings ก่อน
	const [chats, stored] = await Promise.all([
		loadChats(locals, user),
		user ? loadUserSettings(db, user.id) : Promise.resolve({ row: null, error: null })
	]);

	if (chats.error) createLogger().write('error', 'โหลดรายการแชทไม่สำเร็จ', { reason: chats.error });

	const choices = activeChoicesFromRow(stored.row);
	const activeStyle =
		user && choices.styleId
			? await loadStyle(db, user.id, choices.styleId)
			: { row: null, error: null };

	return {
		user,
		chats: chats.rows,
		// ลำดับความสำคัญ: คุกกี้ (ค่าล่าสุดที่เพิ่งกดในเครื่องนี้) -> ตาราง user_settings -> ค่าเริ่มต้น
		settings: resolveUserSettings(cookies.get(THEME_COOKIE), {
			...userSettingsFromRow(stored.row),
			...parseLayoutCookie(cookies.get(LAYOUT_COOKIE))
		}),
		// โทเค็นสี/มุมของสไตล์ที่ใช้อยู่ (null = ใช้ค่าตั้งต้นใน layout.css)
		stylePreset: activeStyle.row ? stylePresetFromRow(activeStyle.row, true) : null,
		choices,
		settingsError: stored.error ?? activeStyle.error
	};
};
