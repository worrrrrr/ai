/**
 * โปรไฟล์ผู้ใช้ — ตารางจริงผูก FK มาที่ `profiles.id`
 * (`chats.owner_id`, `provider_credentials.user_id`, `user_settings.user_id`, `styles.user_id`)
 *
 * ถ้าผู้ใช้ยังไม่มีแถวใน `profiles` (เช่นยังไม่มี trigger ตอน signup) การ insert จะล้มด้วย
 * foreign key violation 23503 — ไฟล์นี้จึงสร้างแถวขั้นต่ำให้ก่อน
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';

type Db = SupabaseClient<Database>;

/** คืน null เมื่อมีโปรไฟล์พร้อมใช้ หรือข้อความ error ภาษาไทยเมื่อสร้างไม่ได้ */
export async function ensureProfile(
	supabase: Db,
	user: { id: string; email?: string | null }
): Promise<string | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('id')
		.eq('id', user.id)
		.maybeSingle();
	if (error) return error.message;
	if (data) return null;

	const { error: upsertError } = await supabase
		.from('profiles')
		.upsert({ id: user.id, email: user.email ?? '' });

	if (upsertError) {
		return `สร้างโปรไฟล์ไม่สำเร็จ (${upsertError.message}) — ตรวจว่าผู้ใช้นี้มีแถวในตาราง profiles`;
	}

	return null;
}
