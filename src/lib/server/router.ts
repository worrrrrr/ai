/**
 * ตรรกะการเลือกเครื่องมือของ router (Tev1) แยกมาเป็น pure function เพื่อทดสอบได้
 * โดยไม่ต้องมี Ollama หรือ network
 */

export type ToolStrategy = 'no-tools' | 'forced' | 'filtered' | 'fallback';

/** ชื่อ tool ที่ผู้ใช้สั่งเองได้ผ่าน `/command` (ฝั่ง client ส่งมากับ body) */
export const COMMAND_TOOLS = ['calculate', 'search', 'weather'] as const;
export type CommandTool = (typeof COMMAND_TOOLS)[number];

/** mapping จาก choice ของ Tev1 ไปชื่อ tool */
const choiceToTool: Record<string, string> = {
	math: 'calculate',
	search: 'search',
	weather: 'weather'
};

/** คะแนนขั้นต่ำที่ยังเชื่อคำตัดสินของ Tev1 (ต่ำกว่านี้ = ส่งทุก tool ให้โมเดลเลือกเอง) */
export const MIN_ROUTER_SCORE = 0.4;

export function selectTools(
	choice: string,
	score: number,
	available: readonly string[],
	forced: readonly string[] = []
): { names: string[]; strategy: ToolStrategy } {
	// ผู้ใช้เลือกเองผ่าน /command — ใช้ตามนั้น ไม่ต้องพึ่งการเดาของ Tev1
	const forcedAvailable = forced.filter((name) => available.includes(name));
	if (forcedAvailable.length > 0) return { names: forcedAvailable, strategy: 'forced' };

	// งานวิเคราะห์/หาเหตุผลไม่ต้องใช้ tool
	if (choice === 'reason') return { names: [], strategy: 'no-tools' };

	// Object.hasOwn เพื่อไม่ให้ชื่อจาก prototype (constructor, toString, ...) ถูกมองเป็น choice จริง
	const name = Object.hasOwn(choiceToTool, choice) ? choiceToTool[choice] : undefined;
	if (name && score >= MIN_ROUTER_SCORE && available.includes(name)) {
		return { names: [name], strategy: 'filtered' };
	}

	// ไม่มั่นใจหรือ tool ไม่มีจริง — ปล่อยให้โมเดลเลือกเองจาก tool ทั้งหมด
	return { names: [...available], strategy: 'fallback' };
}
