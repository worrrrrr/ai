import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UIMessage } from 'ai';

export type ChatRow = {
	id: string;
	title: string;
	updated_at: string;
};

function textOf(message: UIMessage): string {
	return message.parts
		.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
		.map((p) => p.text)
		.join(' ')
		.trim();
}

export function titleFromMessages(messages: UIMessage[]): string {
	const first = messages.find((m) => m.role === 'user');
	const text = first ? textOf(first) : '';
	if (!text) return 'แชทใหม่';
	return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

/**
 * สร้างแถวของ chat ถ้ายังไม่มี
 * คืน false เมื่อ chatId นี้เป็นของคนอื่น (RLS จะไม่คืนแถวของคนอื่นให้ select อยู่แล้ว)
 * หรือเมื่อสร้างไม่สำเร็จ เพื่อไม่ให้เขียน message ลง chat ที่เราไม่ได้เป็นเจ้าของ
 */
export async function ensureChat(
	supabase: SupabaseClient,
	user: User,
	chatId: string,
	title: string
): Promise<boolean> {
	const { data } = await supabase.from('chats').select('id').eq('id', chatId).maybeSingle();
	if (data) return true;

	const { error } = await supabase.from('chats').insert({ id: chatId, user_id: user.id, title });
	if (error && error.code !== '23505') {
		console.error('[chats] create failed:', error.message);
		return false;
	}
	return true;
}

/** upsert message ทั้งชุด (id มาจาก client จึงใช้เป็น key ได้ตรง ๆ) */
export async function saveMessages(
	supabase: SupabaseClient,
	user: User,
	chatId: string,
	messages: UIMessage[]
): Promise<void> {
	const rows = messages
		.filter((m) => m.role !== 'system')
		.map((m) => ({
			id: m.id,
			chat_id: chatId,
			user_id: user.id,
			role: m.role,
			parts: m.parts
		}));

	if (rows.length === 0) return;

	const { error } = await supabase.from('messages').upsert(rows, { onConflict: 'id' });
	if (error) console.error('[chats] save messages failed:', error.message);
}

export async function touchChat(supabase: SupabaseClient, chatId: string): Promise<void> {
	const { error } = await supabase
		.from('chats')
		.update({ updated_at: new Date().toISOString() })
		.eq('id', chatId);
	if (error) console.error('[chats] touch failed:', error.message);
}

export async function loadMessages(supabase: SupabaseClient, chatId: string): Promise<UIMessage[]> {
	const { data, error } = await supabase
		.from('messages')
		.select('id, role, parts')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true });

	if (error) {
		console.error('[chats] load messages failed:', error.message);
		return [];
	}

	return (data ?? []).map((row) => ({
		id: row.id,
		role: row.role,
		parts: row.parts
	})) as UIMessage[];
}
