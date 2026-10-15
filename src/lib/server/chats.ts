import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UIMessage } from 'ai';
import type { Database } from '#lib/database.types.ts';
import { ensureProfile } from './profiles.ts';

type Db = SupabaseClient<Database>;

export type ChatRow = {
	id: string;
	title: string;
	updated_at: string;
};

export type ChatRole = 'system' | 'user' | 'assistant';

/** ข้อมูลโมเดลที่ใช้ตอบ — ตารางจริงเก็บเป็นคอลัมน์แบน ไม่ได้อยู่ในก้อนข้อความ */
export type MessageMeta = {
	model?: string;
	provider?: string;
	temperature?: number | null;
	/** เอเจนต์ที่ตอบข้อความนี้ (ว่างได้) */
	agentId?: string | null;
	/** เวลาที่ใช้ตอบ (มิลลิวินาที) — คอลัมน์มีอยู่จริงแต่เดิมไม่เคยเขียน */
	durationMs?: number | null;
};

export function isChatRole(value: string): value is ChatRole {
	return value === 'system' || value === 'user' || value === 'assistant';
}

function textOf(message: UIMessage): string {
	return message.parts
		.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
		.map((part) => part.text)
		.join(' ')
		.trim();
}

function reasoningOf(message: UIMessage): string {
	return message.parts
		.filter((part): part is { type: 'reasoning'; text: string } => part.type === 'reasoning')
		.map((part) => part.text)
		.join('\n')
		.trim();
}

export function titleFromMessages(messages: UIMessage[]): string {
	const first = messages.find((message) => message.role === 'user');
	const text = first ? textOf(first) : '';
	if (!text) return 'แชทใหม่';
	return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

/**
 * ฐานข้อมูลจริงเก็บข้อความเป็นข้อความแบน (`content` + `reasoning`) ไม่มี `parts`
 * จึงต้องประกอบกลับเป็น parts ให้ UI ใช้ — ข้อจำกัดที่รู้ตัว: tool call/ผลลัพธ์ของ tool
 * ไม่มีคอลัมน์ให้เก็บ หลัง refresh จะเหลือเฉพาะข้อความและการคิดของโมเดล
 */
import { createLogger } from '#lib/server/log.ts';

/** บันทึกเหตุการณ์ของชั้นข้อมูล — ระดับมาจาก env ผ่าน createLogger (ค่าเริ่มต้น info) */
const log = createLogger();

export function messageFromRow(row: {
	id: string;
	role: string;
	content: string;
	reasoning: string | null;
	/** คอลัมน์จริงในตาราง — ใช้แสดง "ใครตอบ ใช้เวลาเท่าไร" แม้หลังรีเฟรช */
	model?: string | null;
	provider?: string | null;
	duration_ms?: number | null;
}): UIMessage | null {
	if (!isChatRole(row.role)) return null;

	const parts: UIMessage['parts'] = [];
	if (row.reasoning) {
		parts.push({ type: 'reasoning', text: row.reasoning } as UIMessage['parts'][number]);
	}
	if (row.content) {
		parts.push({ type: 'text', text: row.content } as UIMessage['parts'][number]);
	}

	return {
		id: row.id,
		role: row.role,
		parts,
		metadata: {
			model: row.model ?? '',
			provider: row.provider ?? '',
			durationMs: row.duration_ms ?? null
		}
	} as UIMessage;
}

/**
 * สร้างแถวของ chat ถ้ายังไม่มี
 * คืน false เมื่อ chatId นี้เป็นของคนอื่น (RLS จะไม่คืนแถวของคนอื่นให้ select อยู่แล้ว)
 * หรือเมื่อสร้างไม่สำเร็จ เพื่อไม่ให้เขียนข้อความลง chat ที่เราไม่ได้เป็นเจ้าของ
 */
export async function ensureChat(
	supabase: Db,
	user: User,
	chatId: string,
	title: string
): Promise<boolean> {
	const { data } = await supabase.from('chats').select('id').eq('id', chatId).maybeSingle();
	if (data) return true;

	const insert = () => supabase.from('chats').insert({ id: chatId, owner_id: user.id, title });
	let { error } = await insert();

	// chats.owner_id อ้าง profiles.id — ถ้ายังไม่มีแถว profile ของผู้ใช้นี้ ให้สร้างขั้นต่ำแล้วลองใหม่หนึ่งครั้ง
	if (error?.code === '23503') {
		const profileError = await ensureProfile(supabase, user);
		if (!profileError) ({ error } = await insert());
	}

	if (error && error.code !== '23505') {
		log.write('error', 'สร้างแชทไม่สำเร็จ', {
			reason: error.message,
			hint: 'ตรวจว่าตาราง chats มีคอลัมน์ owner_id และมีแถวใน profiles ของผู้ใช้นี้'
		});
		return false;
	}

	return true;
}

/** upsert ข้อความทั้งชุด (id มาจาก client จึงใช้เป็น key ได้ตรง ๆ) */
export async function saveMessages(
	supabase: Db,
	user: User,
	chatId: string,
	messages: UIMessage[],
	meta: MessageMeta = {}
): Promise<void> {
	const rows = messages
		.filter((message) => message.role !== 'system')
		.map((message) => ({
			// `chat_messages.id` เป็น uuid — ส่วน id ที่ client (AI SDK) สร้างไม่ใช่ uuid
			// จึงต้องสร้างของเราเอง ไม่งั้น insert ล้มด้วย "invalid input syntax for type uuid"
			id: crypto.randomUUID(),
			chat_id: chatId,
			user_id: user.id,
			role: message.role,
			content: textOf(message),
			reasoning: reasoningOf(message),
			model: meta.model ?? '',
			provider: meta.provider ?? '',
			temperature: meta.temperature ?? null,
			agent_id: meta.agentId ?? null,
			duration_ms: meta.durationMs ?? null
		}));

	if (rows.length === 0) return;

	const { error } = await supabase.from('chat_messages').upsert(rows, { onConflict: 'id' });
	if (error) log.write('error', 'บันทึกข้อความไม่สำเร็จ', { reason: error.message });
}

export async function touchChat(supabase: Db, chatId: string): Promise<void> {
	const { error } = await supabase
		.from('chats')
		.update({ updated_at: new Date().toISOString() })
		.eq('id', chatId);

	if (error) log.write('error', 'อัปเดตเวลาแชทไม่สำเร็จ', { reason: error.message });
}

export async function loadMessages(supabase: Db, chatId: string): Promise<UIMessage[]> {
	const { data, error } = await supabase
		.from('chat_messages')
		.select('id, role, content, reasoning, model, provider, duration_ms')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true });

	if (error) {
		log.write('error', 'โหลดข้อความไม่สำเร็จ', { reason: error.message });
		return [];
	}

	return (data ?? [])
		.map(messageFromRow)
		.filter((message): message is UIMessage => message !== null);
}
