import { z } from 'zod';

/**
 * สคีมาบันทึกทีม — แยกออกจาก route เพื่อให้เทสต์ได้โดยไม่ต้องมี request/ฐานข้อมูล
 * (ค่าจริงที่ผู้ใช้เห็น: ชื่อ 1-60 ตัวอักษร · สมาชิก 1-4 ตัว · หัวหน้าไม่บังคับ)
 */
export const saveTeamSchema = z.object({
	name: z.string().trim().min(1, 'ต้องมีชื่อทีม').max(60, 'ชื่อทียาวเกิน 60 ตัวอักษร'),
	agentIds: z.array(z.string().min(1).max(80)).min(1, 'ต้องมีสมาชิกอย่างน้อย 1 ตัว').max(4),
	leadAgentId: z.string().min(1).max(80).optional()
});
