/**
 * ตรวจ/ทำชื่อแชทให้สะอาด — แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อให้เทสต์ได้
 * (ตรรกะเดิมฝังอยู่ใน action `rename` ทำให้ทดสอบไม่ได้โดยไม่ต้องมี request/ฐานข้อมูล)
 */

export const CHAT_TITLE_MAX = 120;

export type TitleResult = { ok: true; title: string } | { ok: false; message: string };

/** รับค่าดิบจากฟอร์ม → คืนชื่อที่พร้อมบันทึก หรือเหตุผลที่ใช้ไม่ได้ (ภาษาไทย) */
export function normalizeChatTitle(raw: unknown): TitleResult {
	const title = String(raw ?? '')
		.trim()
		.replace(/\s+/g, ' ');

	if (!title) return { ok: false, message: 'ต้องมีชื่อแชท' };
	if (title.length > CHAT_TITLE_MAX) {
		return { ok: false, message: `ชื่อยาวเกิน ${CHAT_TITLE_MAX} ตัวอักษร` };
	}

	return { ok: true, title };
}
