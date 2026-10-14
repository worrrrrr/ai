import type { ChatRow } from '#lib/server/chats.ts';
import { resolveUserSettings, type AppUser } from '#lib/settings.ts';

export const load = async ({ locals, cookies }) => {
	const user: AppUser | null = locals.user
		? { id: locals.user.id, email: locals.user.email ?? null }
		: null;

	// รายการแชทของ sidebar — ผู้ใช้ที่ยังไม่ยืนยันตัวตนไม่ต้องยิง query
	let chats: ChatRow[] = [];
	if (user) {
		const { data, error } = await locals.supabase
			.from('chats')
			.select('id, title, updated_at')
			.order('updated_at', { ascending: false })
			.limit(50);

		if (error) console.error('[layout] chat list failed:', error.message);
		chats = (data ?? []) as ChatRow[];
	}

	return {
		user,
		chats,
		settings: resolveUserSettings(cookies.get('theme'))
	};
};
