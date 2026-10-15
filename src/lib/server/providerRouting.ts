/**
 * ตัดสิน "ปลายทาง" ที่จะยิงของเอเจนต์หนึ่งตัว — กติกาสำคัญ: **ห้ามถอยไป Ollama เงียบ ๆ**
 *
 * - ไม่ตั้ง `provider_id`      → ใช้ค่าเริ่มต้นของระบบ (Ollama)
 * - ตั้งไว้และใช้งานได้        → ยิงผู้ให้บริการนั้นจริง (คืน ciphertext ของคีย์ ให้ผู้เรียกเปิดเอง)
 * - ตั้งไว้แต่ใช้ไม่ได้        → คืน error ภาษาไทยให้โชว์เป็นสถานะ "ล้ม" ของคนนั้น
 *   (ผู้ให้บริการถูกลบ · ไม่มี base URL · ยังไม่มีคีย์)
 *
 * เป็นฟังก์ชันบริสุทธิ์ล้วน → เทสต์ได้โดยไม่ต้องมีเครือข่าย/ฐานข้อมูล
 */

/** เฉพาะคอลัมน์ที่ใช้ตัดสิน (ตรงกับตาราง `provider_credentials`) */
export type CredentialLike = {
	id: string;
	label: string | null;
	base_url: string | null;
	key_sealed: string | null;
};

export type RouteDecision =
	| { kind: 'default' }
	| { kind: 'provider'; label: string; baseUrl: string; sealed: string }
	| { kind: 'error'; message: string; label?: string };

export function decideRoute(
	providerId: string | null | undefined,
	credentials: CredentialLike[]
): RouteDecision {
	if (!providerId || !providerId.trim()) return { kind: 'default' };

	const credential = credentials.find((item) => item.id === providerId);
	if (!credential) {
		return {
			kind: 'error',
			message:
				'เอเจนต์นี้ตั้งผู้ให้บริการไว้ แต่ไม่พบข้อมูลผู้ให้บริการนั้น (อาจถูกลบ) — ไม่ยิง เพื่อไม่ให้ได้คำตอบจากที่อื่นโดยไม่ตั้งใจ'
		};
	}

	const label = credential.label?.trim() || credential.id;

	if (!credential.base_url?.trim()) {
		return { kind: 'error', message: `ผู้ให้บริการ “${label}” ยังไม่ได้ตั้ง base URL` };
	}

	if (!credential.key_sealed) {
		return {
			kind: 'error',
			message: `ผู้ให้บริการ “${label}” ยังไม่มีคีย์ — บันทึกคีย์ก่อนจึงจะใช้ได้`
		};
	}

	return {
		kind: 'provider',
		label,
		baseUrl: credential.base_url.trim(),
		sealed: credential.key_sealed
	};
}
