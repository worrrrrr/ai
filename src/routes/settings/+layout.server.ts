import { ensureProfile } from '#lib/server/profiles.ts';

/**
 * ทุกหน้าใน /settings ต้องมีแถวใน `profiles` ก่อน
 * เพราะ FK ของ chats.owner_id, provider_credentials.user_id, user_settings.user_id และ styles.user_id
 * ชี้มาที่ profiles.id — ถ้าไม่มีแถว การบันทึกจะล้มด้วย 23503
 */
export const load = async ({ locals }) => {
	if (!locals.user) return { profileError: null };

	const profileError = await ensureProfile(locals.supabase, locals.user);
	return { profileError };
};
