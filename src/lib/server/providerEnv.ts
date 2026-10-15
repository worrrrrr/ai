/**
 * ผู้ให้บริการที่ตั้งไว้ใน environment (.env) — ใช้ค่าที่เจ้าของตั้งจริง ไม่เพิ่ม dependency
 *
 * ทำไมต้องมี: เส้นทางยิงโมเดลอ่านคีย์จากตาราง `provider_credentials` เท่านั้น
 * ทำให้คีย์ที่อยู่ใน `.env` (GROQ / GEMINI / DEEPSEEK) **ไม่ถูกใช้เลย**
 * โมดูลนี้แปลง env -> "ปลายทางที่พร้อมใช้" ให้เส้นทางยิงเลือกได้เท่าเทียม Ollama
 *
 * ตรวจด้วยการยิงจริงแล้ว (2026-10-15): groq `openai/gpt-oss-20b` 200 · google `gemini-3.5-flash-lite` 200 ·
 * deepseek `deepseek-v4-flash` 200 และ models.dev ยืนยันทั้งสามตัวว่า `tool_call: true`
 */

export type EnvProvider = {
	/** รหัสอ้างอิงในแอป — ขึ้นต้น `env:` เพื่อไม่ชนกับ id ที่มาจากฐานข้อมูล */
	id: string;
	label: string;
	baseUrl: string;
	apiKey: string;
	model: string;
};

type EnvLike = Record<string, string | undefined>;

/** ปลายทางมาตรฐาน (OpenAI-compatible) ของผู้ให้บริการที่รู้จัก */
const KNOWN_PROVIDERS: {
	key: string;
	label: string;
	baseUrl: string;
	modelVar: string;
	defaultModel: string;
}[] = [
	{
		key: 'GROQ',
		label: 'Groq (.env)',
		baseUrl: 'https://api.groq.com/openai/v1',
		modelVar: 'GROQ_MODEL',
		defaultModel: 'openai/gpt-oss-20b'
	},
	{
		key: 'GEMINI',
		label: 'Gemini (.env)',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		modelVar: 'GEMINI_MODEL',
		defaultModel: 'gemini-2.5-flash'
	},
	{
		key: 'DEEPSEEK',
		label: 'DeepSeek (.env)',
		baseUrl: 'https://api.deepseek.com',
		modelVar: 'DEEPSEEK_MODEL',
		defaultModel: 'deepseek-flash'
	}
];

/**
 * อ่านผู้ให้บริการจาก env — **ตัวที่ไม่มีคีย์จะถูกข้าม** (ไม่แต่งปลายทางขึ้นเอง)
 * และไม่คืนคีย์ออกไปทางอื่นนอกจากฟิลด์ `apiKey` ที่ผู้เรียกต้องใช้ยิง
 */
export function envProviders(env: EnvLike | undefined): EnvProvider[] {
	if (!env) return [];

	return KNOWN_PROVIDERS.flatMap((provider) => {
		const apiKey = env[`${provider.key}_API_KEY`]?.trim();
		if (!apiKey) return [];

		return [
			{
				id: `env:${provider.key.toLowerCase()}`,
				label: provider.label,
				baseUrl: env[`${provider.key}_BASE_URL`]?.trim() || provider.baseUrl,
				apiKey,
				model: env[provider.modelVar]?.trim() || provider.defaultModel
			}
		];
	});
}
