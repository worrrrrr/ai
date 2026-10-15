/**
 * หน้าแรก: โหลดเอเจนต์ + ทีมถาวรของผู้ใช้ และรับคำสั่งบันทึก/ลบทีม
 *
 * - มี `?agent=<id>` → โหลดตัวนั้นมาแสดง (โหมดแชทเดี่ยว ส่งต่อไปกับทุกข้อความ)
 * - `teams` = ทีมถาวรที่ผ่านการตรวจแล้ว (เอเจนต์ที่ถูกลบไปจะถูกตัดออก พร้อมบอกจำนวน)
 */
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import {
	agentTeamDb,
	createAgentTeam,
	deleteAgentTeam,
	listAgentTeams,
	resolveTeamMembers
} from '#lib/server/agentTeams.ts';
import { listRecentOrchestrations, orchestrationDb } from '#lib/server/orchestrations.ts';
import { presentRunStatus } from '#lib/server/orchestrator.ts';
import { createLogger } from '#lib/server/log.ts';
import { saveTeamSchema } from '#lib/server/teamSchema.ts';

export const load = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) return { agent: null, agents: [], teams: [], runs: [] };

	// แยก await สองครั้ง (ไม่ใช้ Promise.all) — Promise.all ทำให้ชนิดของ error เป็น union แล้ว TS แยกไม่ออก
	const { data: agents, error: listError } = await locals.supabase
		.from('agents')
		.select('id, name, model')
		.eq('owner_id', user.id)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (listError)
		createLogger().write('error', 'โหลดรายการเอเจนต์ไม่สำเร็จ', { reason: listError.message });

	const { teams: rawTeams, error: teamsError } = await listAgentTeams(
		agentTeamDb(locals.supabase),
		user.id
	);

	if (teamsError) createLogger().write('error', 'โหลดรายการทีมไม่สำเร็จ', { reason: teamsError });

	// รอบล่าสุด (ทุกแชท) — ให้เห็นว่าอะไรจบ/กำลังทำ/หยุดกลางคัน โดยไม่ต้องเข้าแชทก่อน
	const { rows: runRows, error: runsError } = await listRecentOrchestrations(
		orchestrationDb(locals.supabase),
		user.id
	);

	if (runsError) createLogger().write('error', 'โหลดรอบการทำงานไม่สำเร็จ', { reason: runsError });

	const runs = runRows.map((row) => ({
		id: row.id,
		chatId: row.chat_id,
		title: row.prompt.length > 70 ? `${row.prompt.slice(0, 70)}…` : row.prompt,
		status: presentRunStatus(row.status, row.updated_at),
		error: row.error,
		createdAt: row.created_at
	}));

	const roster = agents ?? [];

	// ทีมที่ชี้ไปเอเจนต์ซึ่งถูกลบไปแล้ว → ตัดออก และส่งจำนวนที่ตัดไปให้ผู้ใช้เห็น
	const teams = rawTeams
		.map((team) => {
			const resolved = resolveTeamMembers(team, roster);
			return { id: team.id, name: team.name, ...resolved };
		})
		.filter((team) => team.members.length > 0);

	const agentId = url.searchParams.get('agent');
	if (!agentId) return { agent: null, agents: roster, teams, runs };

	const { data, error } = await locals.supabase
		.from('agents')
		.select('id, name, model, description')
		.eq('id', agentId)
		.eq('owner_id', user.id)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) createLogger().write('error', 'โหลดเอเจนต์ไม่สำเร็จ', { reason: error.message });
	return { agent: data ?? null, agents: roster, teams, runs };
};

export const actions = {
	/** บันทึกชุดที่ผู้ใช้ติ๊กอยู่ในตอนนี้เป็นทีมถาวร ใช้ซ้ำได้ */
	saveTeam: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const rawIds = String(form.get('agent_ids') ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);
		const leadAgentId = String(form.get('lead_agent_id') ?? '').trim();

		const parsed = saveTeamSchema.safeParse({
			name: String(form.get('name') ?? '').trim(),
			agentIds: rawIds,
			leadAgentId: leadAgentId || undefined
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
		}

		// ตรวจกับเอเจนต์ที่มีจริงก่อนเขียน (client ไม่ใช่ด่านความจริง)
		const { data: agents, error: agentsError } = await locals.supabase
			.from('agents')
			.select('id')
			.eq('owner_id', user.id)
			.is('deleted_at', null)
			.in('id', parsed.data.agentIds);

		if (agentsError) return fail(500, { message: agentsError.message });
		if ((agents ?? []).length !== parsed.data.agentIds.length) {
			return fail(400, { message: 'มีเอเจนต์ที่เลือกไว้แต่ไม่พบในบัญชีของคุณ' });
		}

		const lead = parsed.data.agentIds.includes(parsed.data.leadAgentId ?? '')
			? parsed.data.leadAgentId!
			: parsed.data.agentIds[0];

		const created = await createAgentTeam(
			agentTeamDb(locals.supabase),
			user.id,
			parsed.data.name,
			parsed.data.agentIds.map((agentId) => ({ agentId, isLead: agentId === lead }))
		);

		if (created.error) return fail(500, { message: created.error });
		return { ok: `บันทึกทีม “${parsed.data.name}” แล้ว` };
	},

	deleteTeam: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('team_id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบทีมที่ต้องการลบ' });

		const { error } = await deleteAgentTeam(agentTeamDb(locals.supabase), user.id, id);
		if (error) return fail(500, { message: error });
		return { ok: 'ลบทีมแล้ว' };
	}
};
