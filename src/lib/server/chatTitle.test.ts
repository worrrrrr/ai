import { describe, expect, it } from 'vitest';
import { CHAT_TITLE_MAX, normalizeChatTitle } from './chatTitle.ts';

describe('normalizeChatTitle', () => {
	it('ตัดช่องว่างหัวท้ายและยุบช่องว่างซ้ำให้เหลือช่องเดียว', () => {
		const result = normalizeChatTitle('   สรุป   งาน \n วันนี้  ');
		expect(result).toEqual({ ok: true, title: 'สรุป งาน วันนี้' });
	});

	it('ค่าว่าง/ช่องว่างล้วน/ไม่มีค่า → ใช้ไม่ได้ พร้อมเหตุผลภาษาไทย', () => {
		expect(normalizeChatTitle('')).toEqual({ ok: false, message: 'ต้องมีชื่อแชท' });
		expect(normalizeChatTitle('   \n\t ')).toEqual({ ok: false, message: 'ต้องมีชื่อแชท' });
		expect(normalizeChatTitle(null)).toEqual({ ok: false, message: 'ต้องมีชื่อแชท' });
		expect(normalizeChatTitle(undefined)).toEqual({ ok: false, message: 'ต้องมีชื่อแชท' });
	});

	it('ยาวเกินเพดาน → ปฏิเสธ และบอกเพดานจริง', () => {
		const result = normalizeChatTitle('ก'.repeat(CHAT_TITLE_MAX + 1));
		expect(result).toEqual({
			ok: false,
			message: `ชื่อยาวเกิน ${CHAT_TITLE_MAX} ตัวอักษร`
		});
	});

	it('พอดีเพดาน → ผ่าน (ขอบเขตไม่คลาดเคลื่อน)', () => {
		const title = 'ก'.repeat(CHAT_TITLE_MAX);
		expect(normalizeChatTitle(title)).toEqual({ ok: true, title });
	});

	it('ค่าที่ไม่ใช่ข้อความถูกแปลงเป็นข้อความก่อนตรวจ (ไม่โยน error)', () => {
		expect(normalizeChatTitle(42)).toEqual({ ok: true, title: '42' });
	});
});
