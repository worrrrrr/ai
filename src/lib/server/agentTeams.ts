/**
 * ทีมถาวรของเอเจนต์ (แบบ Agent Teams ของ DSH) — ชั้นฐานข้อมูลของ `agent_teams` + `agent_team_members`
 *
 * 2 ตารางนี้ยังไม่อยู่ใน type ที่ generate: หลังรัน `supabase/migrations/0006_agent_teams.sql`
 * แล้วสั่ง `pnpm gen:types` ให้ลบ `PendingAgentTeamTables` + `agentTeamDb()` ได้ทันที
 * (แพตเทิร์นเดียวกับ `settingsDb()` ใน `#lib/server/settings.ts` และ `orchestrationDb()`)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';

export type AgentTeamRow = {
	id: string;
	user_id: string;
	name: string;
	created_at: string;
	updated_at: string;
};

export type AgentTeamMemberRow = {
	id: string;
	team_id: string;
	agent_id: string;
	is_lead: boolean;
	sort_order: number;
	created_at: string;
};

type PendingAgentTeamTables = {
	agent_teams: {
		Row: AgentTeamRow;
		Insert: Partial<AgentTeamRow> & { user_id: string; name: string };
		Update: Partial<AgentTeamRow>;
		Relationships: [];
	};
	agent_team_members: {
		Row: AgentTeamMemberRow;
		Insert: Partial<AgentTeamMemberRow> & { team_id: string; agent_id: string };
		Update: Partial<AgentTeamMemberRow>;
		Relationships: [];
	};
};

type DatabaseWithAgentTeams = Omit<Database, 'public'> & {
	public: Omit<Database['public'], 'Tables'> & {
		Tables: Database['public']['Tables'] & PendingAgentTeamTables;
	};
};

export type AgentTeamDb = SupabaseClient<DatabaseWithAgentTeams>;

export function agentTeamDb(supabase: App.Locals['supabase']): AgentTeamDb {
	return supabase as unknown as AgentTeamDb;
}

const MIGRATION_HINT =
	'ยังไม่มีตารางทีมถาวร — รัน supabase/migrations/0006_agent_teams.sql ใน Supabase SQL Editor ก่อน';

function describe(error: { code?: string | null; message?: string | null } | null | undefined) {
	if (!error) return null;

	const code = error.code ?? '';
	const message = error.message ?? '';
	if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(message)) {
		return MIGRATION_HINT;
	}

	return message || 'บันทึกไม่สำเร็จ';
}

/** ทีมหนึ่ง ๆ พร้อมสมาชิก (เรียงตามลำดับที่บันทึกไว้) */
export type AgentTeam = {
	id: string;
	name: string;
	members: { agentId: string; isLead: boolean }[];
};

/** ทีมทั้งหมดของผู้ใช้ + สมาชิกของแต่ละทีม (ยิง 2 ครั้ง ไม่พึ่ง join ของ PostgREST) */
export async function listAgentTeams(
	db: AgentTeamDb,
	userId: string
): Promise<{ teams: AgentTeam[]; error: string | null }> {
	const { data: teams, error } = await db
		.from('agent_teams')
		.select('id, name, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(50);

	if (error) return { teams: [], error: describe(error) };

	const ids = (teams ?? []).map((team) => team.id);
	const members = ids.length
		? ((
				await db
					.from('agent_team_members')
					.select('team_id, agent_id, is_lead, sort_order')
					.in('team_id', ids)
					.order('sort_order', { ascending: true })
			).data ?? [])
		: [];

	return {
		teams: (teams ?? []).map((team) => ({
			id: team.id,
			name: team.name,
			members: members
				.filter((member) => member.team_id === team.id)
				.map((member) => ({ agentId: member.agent_id, isLead: member.is_lead }))
		})),
		error: null
	};
}

/** สร้างทีม + สมาชิกในครั้งเดียว — ถ้าสมาชิกพลาดให้ลบทีมทิ้ง (ไม่เหลือทีมเปล่า) */
export async function createAgentTeam(
	db: AgentTeamDb,
	userId: string,
	name: string,
	members: { agentId: string; isLead: boolean }[]
): Promise<{ id: string | null; error: string | null }> {
	if (members.length === 0) return { id: null, error: 'ทีมต้องมีสมาชิกอย่างน้อย 1 ตัว' };

	const { data, error } = await db
		.from('agent_teams')
		.insert({ user_id: userId, name })
		.select('id')
		.maybeSingle();

	if (error || !data) return { id: null, error: describe(error) ?? 'สร้างทีมไม่สำเร็จ' };

	const { error: memberError } = await db.from('agent_team_members').insert(
		members.map((member, index) => ({
			team_id: data.id,
			agent_id: member.agentId,
			is_lead: member.isLead,
			sort_order: index
		}))
	);

	if (memberError) {
		await db.from('agent_teams').delete().eq('id', data.id);
		return { id: null, error: describe(memberError) };
	}

	return { id: data.id, error: null };
}

/** ลบทีม (สมาชิกถูกลบตามด้วย on delete cascade) */
export async function deleteAgentTeam(
	db: AgentTeamDb,
	userId: string,
	teamId: string
): Promise<{ error: string | null }> {
	const { error } = await db.from('agent_teams').delete().eq('id', teamId).eq('user_id', userId);
	return { error: describe(error) };
}

/**
 * ตรวจว่าทีมชี้ไปเอเจนต์ที่ยังมีอยู่จริงไหม แล้วคืน "ชุดที่พร้อมใช้"
 * (เอเจนต์ที่ถูกลบไปแล้วจะถูกตัดออก พร้อมบอกผู้ใช้ — ไม่ยิงโมเดลมั่ว)
 */
export function resolveTeamMembers(
	team: AgentTeam,
	agents: { id: string; name: string }[]
): { members: { id: string; name: string; isLead: boolean }[]; missing: number } {
	const resolved: { id: string; name: string; isLead: boolean }[] = [];
	let missing = 0;

	for (const member of team.members) {
		const agent = agents.find((item) => item.id === member.agentId);
		if (!agent) {
			missing += 1;
			continue;
		}
		resolved.push({ id: agent.id, name: agent.name, isLead: member.isLead });
	}

	// ถ้าหัวหน้าถูกลบไป ต้องมีหัวหน้าหนึ่งตัวเสมอ → ยกตัวแรกขึ้นเป็นหัวหน้า
	if (resolved.length > 0 && !resolved.some((member) => member.isLead)) {
		resolved[0].isLead = true;
	}

	return { members: resolved, missing };
}
