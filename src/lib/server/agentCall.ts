/**
 * ยิง "หนึ่งเอเจนต์" — ช่วยให้เส้นทาง orchestrator ไม่ต้องรู้รายละเอียดเอง
 *
 * ลำดับ: decideRoute (เลือกปลายทาง) → เปิดคีย์ที่เก็บไว้ → ยิงผู้ให้บริการจริง หรือค่าเริ่มต้นของระบบ
 * กติกาเหล็ก: ถ้าเอเจนต์ตั้งผู้ให้บริการไว้แต่ใช้ไม่ได้ **ต้องคืน error ไม่ถอยไปยิงที่อื่นเงียบ ๆ**
 *
 * ออกแบบให้ทดสอบได้โดยไม่ต้องมีเครือข่าย: ทางเดิน "ค่าเริ่มต้น" รับฟังก์ชันเข้ามา (ผู้เรียกส่ง Ollama มา)
 */
import { openProviderKey } from './settings.ts';
import { callProviderChat } from './providerClient.ts';
import { decideRoute, type CredentialLike } from './providerRouting.ts';

export type AgentCallInput = {
	model: string;
	system: string | null;
	prompt: string;
	temperature: number;
	/** ผู้ให้บริการที่เอเจนต์นี้เลือกไว้ (null = ใช้ค่าเริ่มต้นของระบบ) */
	providerId: string | null;
	/** ผลจาก `decideRoute` — ส่ง credential ที่โหลดมาแล้วเท่านั้น */
	credentials: CredentialLike[];
	/** ผู้ให้บริการจาก .env (id ขึ้นต้น env:) — คีย์เป็นข้อความธรรมดา ไม่ต้องถอดรหัส */
	envProviders?: { id: string; label: string; baseUrl: string; apiKey: string }[];
	/** ค่าของ PROVIDER_KEY_SECRET (null = ยังไม่ได้ตั้ง) */
	keySecret: string | null;
	signal?: AbortSignal;
	/** ทางเดิน "ค่าเริ่มต้น": ผู้เรียกส่งฟังก์ชันที่ยิง Ollama มา (จึงทดสอบด้วยของปลอมได้) */
	runDefault: () => Promise<string>;
};

export async function callAgent(input: AgentCallInput): Promise<{
	text: string | null;
	error: string | null;
	/** ปลายทางที่ใช้จริง — เอาไปเก็บในร่องรอยได้ */
	used: 'provider' | 'default';
	label: string;
}> {
	// ผู้ให้บริการจาก .env มาก่อน (คีย์เป็นข้อความธรรมดา) — ตรวจแล้วว่าใช้ได้จริงกับ Groq/Gemini/DeepSeek
	const envPick = input.envProviders?.find((item) => item.id === input.providerId);
	if (envPick) {
		const envResult = await callProviderChat(
			{ label: envPick.label, baseUrl: envPick.baseUrl, apiKey: envPick.apiKey },
			{
				model: input.model,
				system: input.system,
				prompt: input.prompt,
				temperature: input.temperature
			},
			input.signal
		);

		return {
			text: envResult.text,
			error: envResult.error,
			used: 'provider',
			label: envPick.label
		};
	}

	const decision = decideRoute(input.providerId, input.credentials);

	if (decision.kind === 'error') {
		return {
			text: null,
			error: decision.message,
			used: 'provider',
			label: decision.label ?? 'ไม่ทราบผู้ให้บริการ'
		};
	}

	if (decision.kind === 'provider') {
		if (!input.keySecret) {
			return {
				text: null,
				error: 'ยังไม่ได้ตั้ง PROVIDER_KEY_SECRET จึงเปิดคีย์ของผู้ให้บริการไม่ได้',
				used: 'provider',
				label: decision.label
			};
		}

		let apiKey: string;
		try {
			apiKey = await openProviderKey(input.keySecret, decision.sealed);
		} catch {
			return {
				text: null,
				error: `เปิดคีย์ของ “${decision.label}” ไม่ได้ — คีย์อาจถูกบันทึกด้วยรหัสคนละตัว`,
				used: 'provider',
				label: decision.label
			};
		}

		const result = await callProviderChat(
			{ label: decision.label, baseUrl: decision.baseUrl, apiKey },
			{
				model: input.model,
				system: input.system,
				prompt: input.prompt,
				temperature: input.temperature
			},
			input.signal
		);

		return { text: result.text, error: result.error, used: 'provider', label: decision.label };
	}

	try {
		return {
			text: await input.runDefault(),
			error: null,
			used: 'default',
			label: 'ค่าเริ่มต้นของระบบ'
		};
	} catch (error) {
		return {
			text: null,
			error: error instanceof Error ? error.message : 'ยิงค่าเริ่มต้นของระบบไม่สำเร็จ',
			used: 'default',
			label: 'ค่าเริ่มต้นของระบบ'
		};
	}
}
