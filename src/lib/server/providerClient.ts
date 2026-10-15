/**
 * เรียก "ผู้ให้บริการจริง" ที่ผู้ใช้ตั้งไว้ — OpenAI-compatible: POST {baseUrl}/chat/completions
 *
 * ทำไมใช้ fetch ไม่ใช้ SDK: กติกาโปรเจกต์คือ "เพิ่ม dependency เท่าที่จำเป็น" และการยิงของทีม
 * ไม่ต้องสตรีม จึงเรียกตรงได้ (การสตรีมยังเป็นหน้าที่ของ /api/chat ผ่าน Ollama)
 *
 * ทุกฟังก์ชันที่สร้าง/อ่านข้อมูลเป็น **บริสุทธิ์** → เทสต์ได้โดยไม่ต้องมีเครือข่าย
 * ใช้ได้กับผู้ให้บริการที่ทำ endpoint แบบ OpenAI (Cloudflare AI Gateway, OpenRouter, Gemini
 * ที่เปิดโหมด OpenAI-compatible ฯลฯ) โดยตั้ง base URL ให้ตรงในหน้าผู้ให้บริการ
 */

export type ProviderTarget = {
	/** ไว้ใส่ในข้อความ error ให้ผู้ใช้รู้ว่าใครตอบ */
	label: string;
	baseUrl: string;
	apiKey: string;
};

/** ต่อท้าย /chat/completions ให้เองถ้าผู้ใช้ยังไม่ได้ใส่ (ทนเครื่องหมาย / เกิน) */
export function chatCompletionsUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim().replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

export function buildProviderChatRequest(input: {
	model: string;
	system?: string | null;
	prompt: string;
	temperature?: number;
}): {
	model: string;
	messages: { role: 'system' | 'user'; content: string }[];
	temperature: number;
} {
	const messages: { role: 'system' | 'user'; content: string }[] = [];
	const system = input.system?.trim();
	if (system) messages.push({ role: 'system', content: system });
	messages.push({ role: 'user', content: input.prompt });

	return { model: input.model, messages, temperature: input.temperature ?? 0.7 };
}

/** อ่านข้อความจากคำตอบ — ทนรูปแบบที่ต่างกันเล็กน้อยระหว่างผู้ให้บริการ */
export function readProviderChatText(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') return null;
	const record = payload as Record<string, unknown>;

	const choices = record.choices;
	if (Array.isArray(choices) && choices.length > 0) {
		const first = (choices[0] ?? {}) as Record<string, unknown>;
		const message = first.message as Record<string, unknown> | undefined;
		const content = message?.content ?? first.text;
		if (typeof content === 'string' && content.trim()) return content;
	}

	if (typeof record.output_text === 'string' && record.output_text.trim())
		return record.output_text;

	return null;
}

/** ข้อความ error ที่อ่านรู้เรื่อง (ผู้ให้บริการบางรายส่ง error มากับสถานะ 200) */
export function readProviderError(payload: unknown, status: number): string {
	const record = (payload ?? {}) as Record<string, unknown>;
	const error = record.error as Record<string, unknown> | undefined;

	const message =
		(typeof error?.message === 'string' && error.message) ||
		(typeof record.message === 'string' && record.message) ||
		(typeof record.detail === 'string' && record.detail) ||
		'';

	return message ? `ผู้ให้บริการตอบ ${status}: ${message}` : `ผู้ให้บริการตอบสถานะ ${status}`;
}

/**
 * เลือกโมเดลที่ "น่าจะแชทได้" จากรายการของผู้ให้บริการ
 *
 * เหตุผล: บางผู้ให้บริการมีโมเดลที่ไม่รองรับ /chat/completions (ถอดเสียง/สังเคราะห์เสียง/
 * embedding/ภาพ) — ถ้าเผลอยิงตัวนั้น การกดทดสอบจะล้มทั้งที่คีย์ถูก
 * คืน `null` เมื่อไม่มีตัวที่ควรลอง (ผู้เรียกจะข้ามการทดสอบแชทและบอกผู้ใช้ตามจริง)
 */
const NON_CHAT_MODEL = /(whisper|tts|voice|audio|speech|embed|rerank|moderation|guard|image)/i;

export function pickChatModel(models: string[], preferred?: string | null): string | null {
	const clean = models.map((model) => model.trim()).filter(Boolean);

	if (preferred && clean.includes(preferred) && !NON_CHAT_MODEL.test(preferred)) return preferred;

	return clean.find((model) => !NON_CHAT_MODEL.test(model)) ?? null;
}

/** ยิงจริงหนึ่งครั้ง — คืนข้อความหรือ error ที่อ่านรู้เรื่อง (ไม่โยนออกไปข้างนอก) */
export async function callProviderChat(
	target: ProviderTarget,
	input: { model: string; system?: string | null; prompt: string; temperature?: number },
	signal?: AbortSignal
): Promise<{ text: string | null; error: string | null }> {
	if (!target.baseUrl.trim()) {
		return { text: null, error: `${target.label}: ยังไม่ได้ตั้ง base URL ของผู้ให้บริการ` };
	}
	if (!target.apiKey.trim()) {
		return { text: null, error: `${target.label}: ยังไม่มีคีย์ของผู้ให้บริการ` };
	}

	try {
		const response = await fetch(chatCompletionsUrl(target.baseUrl), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${target.apiKey}`
			},
			body: JSON.stringify(buildProviderChatRequest(input)),
			signal
		});

		const payload: unknown = await response.json().catch(() => null);

		if (!response.ok) return { text: null, error: readProviderError(payload, response.status) };

		const text = readProviderChatText(payload);
		if (!text) {
			// ผู้ให้บริการตอบ 200 แต่ไม่มีข้อความ — มักเป็น error ที่ซ่อนในผลลัพธ์
			return { text: null, error: readProviderError(payload, response.status) };
		}

		return { text, error: null };
	} catch (error) {
		return {
			text: null,
			error: `${target.label}: ${error instanceof Error ? error.message : 'เรียกไม่สำเร็จ'}`
		};
	}
}
