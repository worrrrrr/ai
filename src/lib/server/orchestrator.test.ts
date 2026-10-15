import { describe, expect, it } from 'vitest';
import {
	MAX_ORCHESTRATOR_AGENTS,
	answerPrompt,
	mergePrompt,
	orchestrationStatus,
	planPrompt,
	presentRunStatus,
	selectOrchestratorMembers,
	STALE_RUN_MS,
	summarizeOrchestration,
	type OrchestratorAgent,
	type OrchestrationStep
} from './orchestrator.ts';

const agents: OrchestratorAgent[] = [
	{ id: 'a1', name: 'นักวิจัย', model: 'gpt-oss:120b-cloud', system_prompt: 'อ้างแหล่งเสมอ' },
	{ id: 'a2', name: 'นักคำนวณ', model: 'tev1:4b', system_prompt: null },
	{ id: 'a3', name: 'บรรณาธิการ', model: 'gpt-oss:120b-cloud', system_prompt: 'ย่อให้กระชับ' },
	{ id: 'a4', name: 'นักตรวจข้อเท็จจริง', model: 'nemotron-3-nano:4b', system_prompt: null },
	{ id: 'a5', name: 'เกินเพดาน', model: 'x', system_prompt: null }
];

describe('selectOrchestratorMembers', () => {
	it('ไม่เลือกเลย -> บอกให้เลือกอย่างน้อยหนึ่งตัว', () => {
		const result = selectOrchestratorMembers(agents, []);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toContain('อย่างน้อย 1');
	});

	it('เกินเพดาน -> ปฏิเสธพร้อมบอกเพดาน', () => {
		const tooMany = agents.slice(0, MAX_ORCHESTRATOR_AGENTS + 1).map((agent) => agent.id);
		const result = selectOrchestratorMembers(agents, tooMany);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toContain(String(MAX_ORCHESTRATOR_AGENTS));
	});

	it('มีรหัสที่ไม่รู้จัก -> ปฏิเสธ ไม่ยิงโมเดลมั่ว', () => {
		const result = selectOrchestratorMembers(agents, ['a1', 'ไม่มีอยู่จริง']);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toContain('ไม่พบ');
	});

	it('ตัดรหัสซ้ำ และตั้งหัวหน้าเป็นตัวที่ติ๊กไว้', () => {
		const result = selectOrchestratorMembers(agents, ['a1', 'a1', 'a2', 'a3'], 'a3');
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.members).toHaveLength(3);
		expect(result.lead.id).toBe('a3');
		expect(result.members.filter((member) => member.isLead)).toHaveLength(1);
	});

	it('ไม่ติ๊กหัวหน้า -> ใช้ตัวแรกเป็นหัวหน้า', () => {
		const result = selectOrchestratorMembers(agents, ['a2', 'a1']);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.lead.id).toBe('a2');
	});

	it('ติ๊กหัวหน้าที่ไม่อยู่ในชุด -> ถอยไปใช้ตัวแรก (ไม่พัง)', () => {
		const result = selectOrchestratorMembers(agents, ['a1', 'a2'], 'a5');
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.lead.id).toBe('a1');
	});
});

describe('answerPrompt', () => {
	it('มีคำถามของผู้ใช้ ชื่อเอเจนต์ และจำนวนผู้เชี่ยวชาญ', () => {
		const member = { ...agents[0], isLead: false };
		const prompt = answerPrompt('สรุปงานวิจัยนี้', member, 3);

		expect(prompt).toContain('สรุปงานวิจัยนี้');
		expect(prompt).toContain('นักวิจัย');
		expect(prompt).toContain('3 ผู้เชี่ยวชาญ');
	});

	it('ส่งแผนของทีมเข้าไปด้วยเมื่อหัวหน้าวางแผนไว้', () => {
		const member = { ...agents[1], isLead: false };
		const withoutPlan = answerPrompt('คำถาม', member, 2);
		const withPlan = answerPrompt('คำถาม', member, 2, 'นักวิจัย: ดูหลักฐาน · นักคำนวณ: ตรวจตัวเลข');

		expect(withoutPlan).not.toContain('แผนของทีมรอบนี้');
		expect(withPlan).toContain('แผนของทีมรอบนี้');
		expect(withPlan).toContain('ตรวจตัวเลข');
	});
});

describe('planPrompt', () => {
	it('บอกชื่อทีมและห้ามหัวหน้าตอบคำถามเอง', () => {
		const prompt = planPrompt('สรุปงานวิจัยนี้', ['นักวิจัย', 'บรรณาธิการ']);

		expect(prompt).toContain('สรุปงานวิจัยนี้');
		expect(prompt).toContain('นักวิจัย, บรรณาธิการ');
		expect(prompt).toContain('ห้ามตอบคำถามนี้เอง');
	});

	it('ขอแผนสั้น (คุมเวลาและค่าใช้จ่าย)', () => {
		expect(planPrompt('คำถาม', ['ก'])).toContain('ไม่เกิน 5 บรรทัด');
	});
});

describe('mergePrompt', () => {
	it('รวมคำตอบของทุกคน และใส่กติกาการรวม (รวมทั้ง "ห้ามเลือกข้างเงียบ ๆ")', () => {
		const prompt = mergePrompt('สรุปงานวิจัยนี้', 'บรรณาธิการ', [
			{ name: 'นักวิจัย', content: 'พบงาน 3 ชิ้น' },
			{ name: 'นักคำนวณ', content: '' }
		]);

		expect(prompt).toContain('บรรณาธิการ');
		expect(prompt).toContain('### นักวิจัย');
		expect(prompt).toContain('พบงาน 3 ชิ้น');
		expect(prompt).toContain('(คนนี้ไม่ได้ตอบ');
		expect(prompt).toContain('ห้ามเลือกข้างเงียบ ๆ');
	});
});

describe('summarizeOrchestration / orchestrationStatus', () => {
	const steps: OrchestrationStep[] = [
		{ agentId: null, agentName: 'หัวหน้า', kind: 'plan', content: 'จะถาม 2 คน', durationMs: 120 },
		{
			agentId: 'a1',
			agentName: 'นักวิจัย',
			kind: 'answer',
			content: 'พบงาน 3 ชิ้น',
			durationMs: 800
		},
		{
			agentId: 'a2',
			agentName: 'นักคำนวณ',
			kind: 'answer',
			content: '',
			error: 'หมดเวลา',
			durationMs: 5000
		}
	];

	it('นับคนที่ตอบจริง/ล้ม และรวมเวลา', () => {
		expect(summarizeOrchestration(steps)).toEqual({ answered: 1, failed: 1, totalMs: 5920 });
	});

	it('มีใครตอบอย่างน้อยหนึ่งคน -> done', () => {
		expect(orchestrationStatus(steps)).toBe('done');
	});

	it('ล้มหมด -> failed (ไม่ขึ้นว่า สำเร็จ ทั้งที่ไม่มีคำตอบ)', () => {
		const allFailed: OrchestrationStep[] = [
			{ agentId: 'a1', agentName: 'นักวิจัย', kind: 'answer', content: '', error: 'x' },
			{ agentId: 'a2', agentName: 'นักคำนวณ', kind: 'answer', content: '   ', error: 'y' }
		];

		expect(orchestrationStatus(allFailed)).toBe('failed');
	});
});

describe('presentRunStatus (รอบค้างกลางทางต้องไม่ค้างตลอดไป)', () => {
	const now = Date.parse('2026-10-15T12:00:00.000Z');
	const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

	it('รอบที่จบแล้วคงสถานะเดิม', () => {
		expect(presentRunStatus('done', ago(600), now)).toBe('done');
		expect(presentRunStatus('failed', ago(600), now)).toBe('failed');
	});

	it('planning/running ที่ยังใหม่ = กำลังทำจริง (ไม่ตัดทิ้ง)', () => {
		expect(presentRunStatus('planning', ago(1), now)).toBe('planning');
		expect(presentRunStatus('running', ago(2), now)).toBe('running');
	});

	it('ค้างเกินเพดาน = partial (หยุดกลางคัน)', () => {
		expect(presentRunStatus('running', ago(STALE_RUN_MS / 60_000 + 1), now)).toBe('partial');
		expect(presentRunStatus('planning', ago(30), now)).toBe('partial');
	});

	it('เวลาที่อ่านไม่ได้ หรือสถานะที่ไม่รู้จัก -> ไม่ปล่อยให้ค้าง', () => {
		expect(presentRunStatus('running', 'ไม่ใช่วันที่', now)).toBe('partial');
		expect(presentRunStatus('อะไรก็ไม่รู้', ago(1), now)).toBe('failed');
	});
});
