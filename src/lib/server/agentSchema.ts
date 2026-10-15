import { z } from 'zod';

/**
 * ช่องที่หน้าเอเจนต์รับจากฟอร์ม (ตรงกับคอลัมน์จริงของตาราง agents)
 *
 * เดิมสคีมานี้ถูกเขียนซ้ำใน `/agent/+page.server.ts` และ `/agent/[id]/+page.server.ts`
 * และหลุดกันไปแล้วครั้งหนึ่ง (หน้าแก้ไขข้อความ error หายกลายเป็นอังกฤษ)
 * จึงรวมไว้ที่เดียว + มีเทสต์คุมขอบเขต
 */
export const agentInputSchema = z.object({
	name: z.string().trim().min(1, 'ต้องมีชื่อเอเจนต์').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
	description: z.string().trim().max(300, 'คำอธิบายยาวเกิน 300 ตัวอักษร'),
	model: z.string().trim().min(1, 'ต้องระบุโมเดล').max(120, 'ชื่อโมเดลยาวเกิน 120 ตัวอักษร'),
	providerId: z.string().trim().max(80, 'รหัสผู้ให้บริการยาวเกินไป'),
	systemPrompt: z.string().trim().max(8000, 'พรอมป์ยาวเกิน 8000 ตัวอักษร'),
	temperature: z.coerce
		.number()
		.refine(
			(value) => Number.isFinite(value) && value >= 0 && value <= 2,
			'อุณหภูมิต้องอยู่ระหว่าง 0-2'
		)
});
