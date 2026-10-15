/**
 * AI Agent Orchestrator — ตรรกะบริสุทธิ์ (ไม่พึ่งโมเดล/ฐานข้อมูล) จึงมีเทสต์จริงได้
 *
 * ขั้นของโหมด A: วางแผน → ยิงขนาน → หัวหน้ารวมคำตอบ
 * ไฟล์นี้ตอบแค่ "เลือกใคร · ถามอะไร · สรุปผลอย่างไร" ส่วนการยิงโมเดลจริงอยู่ที่ `api/chat/orchestrate`
 * ตามกติกาโปรเจกต์: อย่าให้ตรรกะปนกับ I/O จะได้พิสูจน์ด้วยเทสต์โดยไม่ต้องมี Ollama
 */

export const MAX_ORCHESTRATOR_AGENTS = 4;

export type OrchestratorAgent = {
	id: string;
	name: string;
	model: string;
	system_prompt: string | null;
};

export type OrchestratorMember = OrchestratorAgent & { isLead: boolean };

export type MemberSelection =
	| { ok: true; members: OrchestratorMember[]; lead: OrchestratorMember }
	| { ok: false; message: string };

/** ขั้นหนึ่งของรอบ (ใช้ทั้งโชว์ร่องรอยใน UI และเก็บลง `orchestration_steps`) */
export type OrchestrationStep = {
	agentId: string | null;
	agentName: string;
	kind: 'plan' | 'answer' | 'merge';
	content: string;
	error?: string | null;
	durationMs?: number | null;
};

/**
 * เลือกชุดผู้เชี่ยวชาญของรอบหนึ่ง
 * - ตัดรหัสซ้ำ, จำกัดจำนวน (กันค่าใช้จ่ายบาน), ต้องพบทุกตัวในบัญชีผู้ใช้
 * - หัวหน้า = ตัวที่ติ๊กไว้ ถ้าไม่ติ๊กให้ใช้ตัวแรก (ผลลัพธ์ต้องมีหัวหน้าหนึ่งตัวเสมอ)
 */
export function selectOrchestratorMembers(
	agents: OrchestratorAgent[],
	requestedIds: string[],
	leadId?: string | null
): MemberSelection {
	const unique = [...new Set(requestedIds.map((id) => id.trim()).filter(Boolean))];

	if (unique.length === 0) return { ok: false, message: 'ต้องเลือกเอเจนต์อย่างน้อย 1 ตัว' };
	if (unique.length > MAX_ORCHESTRATOR_AGENTS) {
		return { ok: false, message: `เลือกได้ไม่เกิน ${MAX_ORCHESTRATOR_AGENTS} เอเจนต์ต่อรอบ` };
	}

	const found = unique
		.map((id) => agents.find((agent) => agent.id === id))
		.filter((agent): agent is OrchestratorAgent => Boolean(agent));

	if (found.length !== unique.length) {
		return { ok: false, message: 'มีเอเจนต์ที่เลือกไว้แต่ไม่พบในบัญชีของคุณ — ตรวจว่ายังไม่ถูกลบ' };
	}

	const leadId2 = leadId && found.some((agent) => agent.id === leadId) ? leadId : found[0].id;
	const members = found.map((agent) => ({ ...agent, isLead: agent.id === leadId2 }));

	return { ok: true, members, lead: members.find((member) => member.isLead)! };
}

/**
 * คำสั่งให้หัวหน้า "วางแผน" ว่าจะแบ่งงานอย่างไร
 * - ห้ามให้หัวหน้าตอบคำถามเอง (จะกลายเป็นตอบซ้ำซ้อนกับตอนรวมคำตอบ)
 * - ขอสั้น ๆ เพื่อคุมเวลา/ค่าใช้จ่าย (แผนยาวไม่ช่วยให้คำตอบดีขึ้น)
 */
export function planPrompt(userPrompt: string, memberNames: string[]): string {
	return [
		`คำถามจากผู้ใช้: ${userPrompt}`,
		'',
		`ทีมที่จะตอบรอบนี้มี: ${memberNames.join(', ')}`,
		'ช่วยวางแผนสั้น ๆ (ไม่เกิน 5 บรรทัด) ว่าแต่ละคนควรเน้นตอบประเด็นใด',
		'ห้ามตอบคำถามนี้เอง — เขียนเป็นแผนงานเท่านั้น ขึ้นต้นด้วยคำกริยาสั้น ๆ ไม่ต้องมีคำนำ',
		'ตอบเป็นภาษาไทย'
	].join('\n');
}

/** คำสั่งที่ส่งให้แต่ละเอเจนต์ตอนยิงขนาน — แต่ละคนตอบจากมุมของตัวเอง ไม่สรุปแทนคนอื่น */
export function answerPrompt(
	userPrompt: string,
	member: OrchestratorMember,
	total: number,
	plan?: string
): string {
	const lines = [
		`คำถามจากผู้ใช้: ${userPrompt}`,
		'',
		`คุณคือ “${member.name}” — หนึ่งใน ${total} ผู้เชี่ยวชาญที่ถูกเรียกมาช่วยตอบรอบนี้`
	];

	if (plan?.trim()) {
		lines.push('', `แผนของทีมรอบนี้ (ใช้กำหนดว่าคุณควรเน้นอะไร): ${plan.trim()}`);
	}

	lines.push(
		'ตอบเฉพาะส่วนที่อยู่ในความถนัดของคุณ กระชับ ตรงคำถาม และไม่ต้องสรุปแทนคนอื่น',
		'ถ้าไม่ได้ใช้เครื่องมือ ให้บอกตรง ๆ ว่าคำตอบมาจากความรู้ของโมเดล ไม่ต้องเดาแหล่งที่มา'
	);

	return lines.join('\n');
}

/** คำสั่งที่ส่งให้หัวหน้า — รวมคำตอบของทุกคนเป็นคำตอบเดียว */
export function mergePrompt(
	userPrompt: string,
	leadName: string,
	answers: { name: string; content: string }[]
): string {
	const blocks = answers.map(
		(answer) => `### ${answer.name}\n${answer.content.trim() || '(คนนี้ไม่ได้ตอบ — ไม่มีข้อมูล)'}`
	);

	return [
		`คำถามจากผู้ใช้: ${userPrompt}`,
		'',
		`คุณคือ “${leadName}” หัวหน้าทีม — รวมคำตอบของผู้เชี่ยวชาญด้านล่างเป็นคำตอบเดียว`,
		'กติกาการรวม:',
		'1) รวมเฉพาะเนื้อหาที่ตอบคำถามนี้จริง ตัดส่วนที่ไม่เกี่ยวออก',
		'2) ถ้าข้อมูลขัดกัน ให้บอกว่าขัดกันและบอกว่าต่างกันตรงไหน ห้ามเลือกข้างเงียบ ๆ',
		'3) อ้างแหล่งที่มาเมื่อมี และบอกว่าใครเป็นคนให้ข้อมูลนั้น',
		'4) ตอบเป็นภาษาไทย กระชับ อ่านจบในครั้งเดียว',
		'',
		blocks.join('\n\n')
	].join('\n');
}

/** สรุปผลของรอบ — นับคนที่ตอบ/ล้ม และเวลารวม (ใช้โชว์ร่องรอยและเก็บสถานะ) */
export function summarizeOrchestration(steps: OrchestrationStep[]): {
	answered: number;
	failed: number;
	totalMs: number;
} {
	const answers = steps.filter((step) => step.kind === 'answer');

	return {
		answered: answers.filter((step) => !step.error && step.content.trim().length > 0).length,
		failed: answers.filter((step) => Boolean(step.error)).length,
		totalMs: steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0)
	};
}

/** สถานะของรอบจากผลจริง: มีใครตอบไหม / ล้มหมดหรือเปล่า */
export function orchestrationStatus(steps: OrchestrationStep[]): 'done' | 'failed' {
	const { answered } = summarizeOrchestration(steps);
	return answered > 0 ? 'done' : 'failed';
}

/**
 * รอบที่ยังค้างสถานะกลางทางนานเกินเพดาน = ถูกตัดกลางคัน (ผู้ใช้ปิดแท็บ / เน็ตหลุด / เครื่องหลับ)
 * ค่านี้ตั้งไว้ให้ยาวกว่าที่รอบจริงใช้ (เพดานเอเจนต์ 60s × 2 ขั้น + เวลารวมคำตอบ) จึงไม่ตัดรอบที่ยังทำงานอยู่
 */
export const STALE_RUN_MS = 5 * 60 * 1000;

export type RunStatus = 'planning' | 'running' | 'done' | 'failed' | 'partial';

/**
 * สถานะที่ "ควรแสดง" ของรอบหนึ่ง — จุดสำคัญคือรอบที่ค้างอยู่จะไม่ค้างตลอดไป
 * - done/failed = จบแล้ว คงเดิม
 * - planning/running ที่ยังใหม่ = กำลังทำจริง
 * - planning/running ที่เก่ากว่าเพดาน = 'partial' (หยุดกลางคัน) ให้ UI บอกผู้ใช้ตรง ๆ
 * - สถานะที่ไม่รู้จัก (ข้อมูลเพี้ยน) = 'failed' ไม่ปล่อยให้ค้าง
 */
export function presentRunStatus(
	status: string,
	updatedAt: string,
	now: number = Date.now(),
	thresholdMs: number = STALE_RUN_MS
): RunStatus {
	if (status === 'done' || status === 'failed') return status;
	if (status !== 'planning' && status !== 'running') return 'failed';

	const updated = Date.parse(updatedAt);
	if (!Number.isFinite(updated)) return 'partial';

	return now - updated > thresholdMs ? 'partial' : status;
}
