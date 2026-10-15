import { describe, expect, it } from 'vitest';
import { saveTeamSchema } from './teamSchema.ts';

const valid = { name: 'ทีมวิจัย', agentIds: ['a1', 'a2'] };

describe('saveTeamSchema', () => {
	it('ผ่านเมื่อข้อมูลครบ', () => {
		expect(saveTeamSchema.safeParse(valid).success).toBe(true);
	});

	it('ตัดช่องว่างหัวท้ายของชื่อทีม', () => {
		const parsed = saveTeamSchema.parse({ ...valid, name: '  ทีมวิจัย  ' });
		expect(parsed.name).toBe('ทีมวิจัย');
	});

	it('ปฏิเสธชื่อว่าง และชื่อที่ยาวเกิน 60', () => {
		expect(saveTeamSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
		expect(saveTeamSchema.safeParse({ ...valid, name: 'ก'.repeat(61) }).success).toBe(false);
	});

	it('สมาชิกต้องมี 1-4 ตัว (ขอบเขตไม่คลาด)', () => {
		expect(saveTeamSchema.safeParse({ ...valid, agentIds: [] }).success).toBe(false);
		expect(saveTeamSchema.safeParse({ ...valid, agentIds: ['a'] }).success).toBe(true);
		expect(saveTeamSchema.safeParse({ ...valid, agentIds: ['a', 'b', 'c', 'd'] }).success).toBe(
			true
		);
		expect(
			saveTeamSchema.safeParse({ ...valid, agentIds: ['a', 'b', 'c', 'd', 'e'] }).success
		).toBe(false);
	});

	it('leadAgentId ไม่บังคับ แต่ถ้าส่งมาต้องไม่ว่าง', () => {
		expect(saveTeamSchema.safeParse(valid).success).toBe(true);
		expect(saveTeamSchema.safeParse({ ...valid, leadAgentId: 'a1' }).success).toBe(true);
		expect(saveTeamSchema.safeParse({ ...valid, leadAgentId: '' }).success).toBe(false);
	});

	it('ข้อความผิดพลาดเป็นภาษาไทยตามที่ผู้ใช้เห็น', () => {
		const result = saveTeamSchema.safeParse({ ...valid, name: '' });
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0]?.message).toBe('ต้องมีชื่อทีม');
	});
});
