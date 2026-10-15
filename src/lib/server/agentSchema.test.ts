import { describe, expect, it } from 'vitest';
import { agentInputSchema } from './agentSchema.ts';

// ส่งครบทุกช่องเหมือนที่ `readAgentForm` ทำจริง (ช่องว่างส่งเป็นข้อความว่าง ไม่ใช่ไม่ส่ง)
const valid = {
	name: 'ผู้ช่วย',
	description: '',
	model: 'gpt-oss:120b-cloud',
	providerId: '',
	systemPrompt: '',
	temperature: '0.7'
};

const parse = (patch: Record<string, unknown>) =>
	agentInputSchema.safeParse({ ...valid, ...patch });
const messageOf = (patch: Record<string, unknown>) => {
	const result = parse(patch);
	return result.success ? '' : (result.error.issues[0]?.message ?? '');
};

describe('agentInputSchema', () => {
	it('ผ่านเมื่อข้อมูลขั้นต่ำครบ และแปลงอุณหภูมิจากข้อความเป็นตัวเลข', () => {
		const result = agentInputSchema.parse(valid);
		expect(result.temperature).toBe(0.7);
		expect(result.description).toBe('');
	});

	it('ชื่อ: ว่างใช้ไม่ได้ · 60 ผ่าน · 61 ไม่ผ่าน (พร้อมข้อความไทย)', () => {
		expect(parse({ name: '  ' }).success).toBe(false);
		expect(parse({ name: 'ก'.repeat(60) }).success).toBe(true);
		expect(parse({ name: 'ก'.repeat(61) }).success).toBe(false);
		expect(messageOf({ name: '' })).toBe('ต้องมีชื่อเอเจนต์');
		expect(messageOf({ name: 'ก'.repeat(61) })).toBe('ชื่อยาวเกิน 60 ตัวอักษร');
	});

	it('คำอธิบาย 300 ผ่าน · 301 ไม่ผ่าน', () => {
		expect(parse({ description: 'ก'.repeat(300) }).success).toBe(true);
		expect(parse({ description: 'ก'.repeat(301) }).success).toBe(false);
		expect(messageOf({ description: 'ก'.repeat(301) })).toBe('คำอธิบายยาวเกิน 300 ตัวอักษร');
	});

	it('โมเดลต้องมีค่า และไม่เกิน 120', () => {
		expect(messageOf({ model: '   ' })).toBe('ต้องระบุโมเดล');
		expect(parse({ model: 'ก'.repeat(121) }).success).toBe(false);
		expect(messageOf({ model: 'ก'.repeat(121) })).toBe('ชื่อโมเดลยาวเกิน 120 ตัวอักษร');
	});

	it('รหัสผู้ให้บริการไม่เกิน 80 และพรอมป์ไม่เกิน 8000', () => {
		expect(messageOf({ providerId: 'ก'.repeat(81) })).toBe('รหัสผู้ให้บริการยาวเกินไป');
		expect(parse({ systemPrompt: 'ก'.repeat(8000) }).success).toBe(true);
		expect(messageOf({ systemPrompt: 'ก'.repeat(8001) })).toBe('พรอมป์ยาวเกิน 8000 ตัวอักษร');
	});

	it('อุณหภูมิต้องอยู่ 0-2 (ขอบเขตและค่านอกช่วง)', () => {
		expect(parse({ temperature: '0' }).success).toBe(true);
		expect(parse({ temperature: '2' }).success).toBe(true);
		expect(parse({ temperature: '2.5' }).success).toBe(false);
		expect(parse({ temperature: '-1' }).success).toBe(false);
		expect(messageOf({ temperature: 'ไม่ได้ใส่ตัวเลข' })).not.toBe('');
	});
});
