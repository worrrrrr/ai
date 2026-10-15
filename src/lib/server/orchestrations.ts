import { createLogger } from '#lib/server/log.ts';
/**
 * ชั้นฐานข้อมูลของ AI Agent Orchestrator (ตาราง `orchestrations` + `orchestration_steps`)
 *
 * 2 ตารางนี้ยังไม่อยู่ใน type ที่ generate จากฐานข้อมูล — ต้องรัน
 * `supabase/migrations/0005_orchestrator.sql` แล้วสั่ง `pnpm gen:types`
 * หลัง regenerate แล้ว บล็อก `PendingOrchestratorTables` + `orchestrationDb()` ลบได้ทันที
 * (แพตเทิร์นเดียวกับ `settingsDb()` ใน `#lib/server/settings.ts`)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';
import type { OrchestrationStep } from './orchestrator.ts';
import { presentRunStatus } from './orchestrator.ts';

export type OrchestrationRow = {
	id: string;
	chat_id: string | null;
	user_id: string;
	prompt: string;
	lead_agent_id: string | null;
	status: string;
	error: string | null;
	created_at: string;
	updated_at: string;
};

export type OrchestrationStepRow = {
	id: string;
	orchestration_id: string;
	agent_id: string | null;
	agent_name: string;
	kind: string;
	content: string;
	error: string | null;
	duration_ms: number | null;
	created_at: string;
};

type PendingOrchestratorTables = {
	orchestrations: {
		Row: OrchestrationRow;
		Insert: Partial<OrchestrationRow> & { user_id: string; prompt: string };
		Update: Partial<OrchestrationRow>;
		Relationships: [];
	};
	orchestration_steps: {
		Row: OrchestrationStepRow;
		Insert: Partial<OrchestrationStepRow> & { orchestration_id: string; kind: string };
		Update: Partial<OrchestrationStepRow>;
		Relationships: [];
	};
};

type DatabaseWithOrchestrator = Omit<Database, 'public'> & {
	public: Omit<Database['public'], 'Tables'> & {
		Tables: Database['public']['Tables'] & PendingOrchestratorTables;
	};
};

export type OrchestrationDb = SupabaseClient<DatabaseWithOrchestrator>;

/** แปลง client ปกติ -> client ที่รู้จักตาราง orchestrator (ลบได้หลังรัน migration + gen:types) */
export function orchestrationDb(supabase: App.Locals['supabase']): OrchestrationDb {
	return supabase as unknown as OrchestrationDb;
}

const MIGRATION_HINT =
	'ยังไม่มีตาราง orchestrator — รัน supabase/migrations/0005_orchestrator.sql ใน Supabase SQL Editor ก่อน';

type TableError = { code?: string | null; message?: string | null } | null | undefined;

function describe(error: TableError): string | null {
	if (!error) return null;

	const code = error.code ?? '';
	const message = error.message ?? '';
	if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(message)) {
		return MIGRATION_HINT;
	}

	return message || 'บันทึกไม่สำเร็จ';
}

/** เปิดรอบใหม่ — คืน id ไว้ผูกขั้นต่าง ๆ และบันทึกสถานะตอนจบ */
export async function createOrchestration(
	db: OrchestrationDb,
	input: { chatId: string | null; userId: string; prompt: string; leadAgentId: string }
): Promise<{ id: string | null; error: string | null }> {
	const { data, error } = await db
		.from('orchestrations')
		.insert({
			chat_id: input.chatId,
			user_id: input.userId,
			prompt: input.prompt,
			lead_agent_id: input.leadAgentId,
			status: 'planning'
		})
		.select('id')
		.maybeSingle();

	if (error) return { id: null, error: describe(error) };
	return { id: data?.id ?? null, error: null };
}

/** เก็บหนึ่งขั้น (plan / answer / merge) — ใช้ทั้งโชว์ร่องรอยและตรวจย้อนหลัง */
export async function addOrchestrationStep(
	db: OrchestrationDb,
	orchestrationId: string,
	step: OrchestrationStep
): Promise<{ error: string | null }> {
	const { error } = await db.from('orchestration_steps').insert({
		orchestration_id: orchestrationId,
		agent_id: step.agentId,
		agent_name: step.agentName,
		kind: step.kind,
		content: step.content,
		error: step.error ?? null,
		duration_ms: step.durationMs ?? null
	});

	return { error: describe(error) };
}

/** ปิดรอบด้วยสถานะจริง (done = มีอย่างน้อยหนึ่งคนตอบ, failed = ไม่มีเลย) */
export async function finishOrchestration(
	db: OrchestrationDb,
	orchestrationId: string,
	status: 'done' | 'failed',
	error: string | null
): Promise<{ error: string | null }> {
	const { error: updateError } = await db
		.from('orchestrations')
		.update({ status, error, updated_at: new Date().toISOString() })
		.eq('id', orchestrationId);

	return { error: describe(updateError) };
}

/** รอบทั้งหมดของแชทหนึ่ง (เรียงใหม่→เก่า) — พร้อม "ปิดรอบค้าง" ให้อัตโนมัติ */
export async function listOrchestrations(
	db: OrchestrationDb,
	chatId: string
): Promise<{ rows: OrchestrationRow[]; error: string | null }> {
	const { data, error } = await db
		.from('orchestrations')
		.select('*')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: false })
		.limit(20);

	if (error) return { rows: [], error: describe(error) };

	const now = Date.now();
	const rows: OrchestrationRow[] = data ?? [];

	// รอบที่ค้างสถานะกลางทาง (ปิดแท็บ/เน็ตหลุด) → ปิดเป็น 'failed' พร้อมบอกเหตุผล
	// จงใจใช้ 'failed' ไม่ใช่ 'partial' เพราะ CHECK ของตารางยอมรับแค่ planning/running/done/failed
	for (const row of rows) {
		if (presentRunStatus(row.status, row.updated_at, now) !== 'partial') continue;

		const note = 'หยุดกลางคัน: รอบไม่ได้ปิดสถานะ (ปิดแท็บหรือการเชื่อมต่อหลุด)';
		const { error: repairError } = await db
			.from('orchestrations')
			.update({ status: 'failed', error: note, updated_at: new Date(now).toISOString() })
			.eq('id', row.id);

		if (repairError) {
			createLogger().write('error', 'ปิดรอบค้างไม่สำเร็จ', { reason: repairError.message });
			continue;
		}

		row.status = 'failed';
		row.error = note;
		row.updated_at = new Date(now).toISOString();
	}

	return { rows, error: null };
}

/**
 * รอบล่าสุดของผู้ใช้ (ทุกแชท) — ให้หน้าแรกเห็นว่า "อะไรจบแล้ว/กำลังทำ/ค้าง" โดยไม่ต้องเข้าแชทก่อน
 * ใช้กติกาปิดรอบค้างชุดเดียวกับ `listOrchestrations` (จงใจแยกฟังก์ชัน ไม่ให้พารามิเตอร์ซับซ้อน)
 */
export async function listRecentOrchestrations(
	db: OrchestrationDb,
	userId: string,
	limit = 8
): Promise<{ rows: OrchestrationRow[]; error: string | null }> {
	const { data, error } = await db
		.from('orchestrations')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(limit);

	if (error) return { rows: [], error: describe(error) };

	const now = Date.now();
	const rows: OrchestrationRow[] = data ?? [];

	for (const row of rows) {
		if (presentRunStatus(row.status, row.updated_at, now) !== 'partial') continue;

		const note = 'หยุดกลางคัน: รอบไม่ได้ปิดสถานะ (ปิดแท็บหรือการเชื่อมต่อหลุด)';
		const { error: repairError } = await db
			.from('orchestrations')
			.update({ status: 'failed', error: note, updated_at: new Date(now).toISOString() })
			.eq('id', row.id);

		if (repairError) {
			createLogger().write('error', 'ปิดรอบค้างไม่สำเร็จ', { reason: repairError.message });
			continue;
		}

		row.status = 'failed';
		row.error = note;
		row.updated_at = new Date(now).toISOString();
	}

	return { rows, error: null };
}
