import { describe, expect, it } from 'vitest';
import { projectInputSchema } from './projectSchema.ts';

// ส่งครบทุกช่องเหมือนที่ action ทำจริง (ช่องว่างส่งเป็นข้อความว่าง ไม่ใช่ไม่ส่ง)
const valid = { name: 'โปรเจกต์ทดลอง', description: '', icon: '', instructions: '' };

const parse = (patch: Record<string, unknown>) =>
	projectInputSchema.safeParse({ ...valid, ...patch });
const messageOf = (patch: Record<string, unknown>) => {
	const result = parse(patch);
	return result.success ? '' : (result.error.issues[0]?.message ?? '');
};

describe('projectInputSchema', () => {
	it('ผ่านเมื่อมีชื่อ และตัดช่องว่างหัวท้าย', () => {
		const result = projectInputSchema.parse({ ...valid, name: '  โปรเจกต์ทดลอง  ' });
		expect(result.name).toBe('โปรเจกต์ทดลอง');
	});

	it('ชื่อ: ว่างใช้ไม่ได้ · 60 ผ่าน · 61 ไม่ผ่าน (ข้อความไทย)', () => {
		expect(parse({ name: '   ' }).success).toBe(false);
		expect(messageOf({ name: '' })).toBe('ต้องมีชื่อโปรเจกต์');
		expect(parse({ name: 'ก'.repeat(60) }).success).toBe(true);
		expect(messageOf({ name: 'ก'.repeat(61) })).toBe('ชื่อยาวเกิน 60 ตัวอักษร');
	});

	it('คำอธิบาย: 300 ผ่าน · 301 ไม่ผ่าน', () => {
		expect(parse({ description: 'ก'.repeat(300) }).success).toBe(true);
		expect(messageOf({ description: 'ก'.repeat(301) })).toBe('คำอธิบายยาวเกิน 300 ตัวอักษร');
	});

	it('ชื่อไอคอน: 60 ผ่าน · 61 ไม่ผ่าน', () => {
		expect(parse({ icon: 'ก'.repeat(60) }).success).toBe(true);
		expect(messageOf({ icon: 'ก'.repeat(61) })).toBe('ชื่อไอคอนยาวเกิน 60 ตัวอักษร');
	});

	it('คำสั่ง: 8000 ผ่าน · 8001 ไม่ผ่าน', () => {
		expect(parse({ instructions: 'ก'.repeat(8000) }).success).toBe(true);
		expect(messageOf({ instructions: 'ก'.repeat(8001) })).toBe('คำสั่งยาวเกิน 8000 ตัวอักษร');
	});
});
