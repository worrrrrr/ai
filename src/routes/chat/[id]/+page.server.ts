import { error, fail } from '@sveltejs/kit';
import { loadMessages } from '#lib/server/chats.ts';
import { normalizeChatTitle } from '#lib/server/chatTitle.ts';
import { summarizeOrchestration, type OrchestrationStep } from '#lib/server/orchestrator.ts';
import { listOrchestrations, orchestrationDb } from '#lib/server/orchestrations.ts';

export const load = async ({ params, locals }) => {
	const { data: chat } = await locals.supabase
		.from('chats')
		.select('id, title')
		.eq('id', params.id)
		.is('deleted_at', null)
		.maybeSingle();

	// กรองเจ้าของด้วย owner_id (ฐานข้อมูลจริง) — แถวของคนอื่นจะไม่ถูกคืน จึงกลายเป็น 404
	if (!chat) error(404, 'ไม่พบแชทนี้');

	const messages = await loadMessages(locals.supabase, chat.id);

	// ร่องรอยของรอบ "ทีมเอเจนต์" ล่าสุด (ถ้าแชทนี้เคยใช้ orchestrator) — ให้เปิดประวัติแล้วเห็นว่าใครตอบอะไร
	const db = orchestrationDb(locals.supabase);
	const { rows } = await listOrchestrations(db, chat.id);
	const run = rows[0] ?? null;

	let orchestration = null;

	if (run) {
		const { data: stepRows } = await db
			.from('orchestration_steps')
			.select('*')
			.eq('orchestration_id', run.id)
			.order('created_at', { ascending: true });

		const steps: OrchestrationStep[] = (stepRows ?? []).map((row) => ({
			agentId: row.agent_id,
			agentName: row.agent_name,
			kind: row.kind as OrchestrationStep['kind'],
			content: row.content,
			error: row.error,
			durationMs: row.duration_ms
		}));

		const mergeStep = steps.find((step) => step.kind === 'merge');

		orchestration = {
			plan: steps.find((step) => step.kind === 'plan')?.content ?? '',
			leadName: mergeStep?.agentName ?? '',
			answers: steps
				.filter((step) => step.kind === 'answer')
				.map((step) => ({
					name: step.agentName,
					content: step.content,
					error: step.error ?? null,
					durationMs: step.durationMs ?? 0
				})),
			merged: mergeStep?.content ?? '',
			error: run.error,
			summary: summarizeOrchestration(steps)
		};
	}

	return { chatId: chat.id, title: chat.title, messages, orchestration };
};

export const actions = {
	/** เปลี่ยนชื่อแชท — เขียนเฉพาะคอลัมน์ `title` ของแชทตัวเอง (ชื่อเดิมมาจากข้อความแรกอัตโนมัติ) */
	rename: async ({ request, params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = normalizeChatTitle((await request.formData()).get('title'));
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const { error: updateError } = await locals.supabase
			.from('chats')
			.update({ title: parsed.title })
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (updateError) return fail(500, { message: updateError.message });
		return { ok: 'เปลี่ยนชื่อแชทแล้ว' };
	},

	/** ลบแชทแบบเก็บประวัติ (soft delete) — ตั้ง `deleted_at` ของแชทตัวเองเท่านั้น ข้อความไม่ถูกลบ */
	delete: async ({ params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const { error: updateError } = await locals.supabase
			.from('chats')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', params.id)
			.eq('owner_id', user.id);

		if (updateError) return fail(500, { message: updateError.message });
		return { ok: 'ลบแชทแล้ว (เก็บประวัติไว้)' };
	}
};
