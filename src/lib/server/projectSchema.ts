import { z } from 'zod';

/**
 * ช่องที่หน้าโปรเจกต์รับจากฟอร์ม (ตรงกับคอลัมน์จริงของตาราง projects)
 *
 * เดิมสคีมานี้ถูกเขียนซ้ำใน `/project/+page.server.ts` และ `/project/[id]/+page.server.ts`
 * และหลุดกัน (หน้าแก้ไขไม่มีข้อความ error ภาษาไทย) — จึงรวมไว้ที่เดียว + มีเทสต์คุมขอบเขต
 */
export const projectInputSchema = z.object({
	name: z.string().trim().min(1, 'ต้องมีชื่อโปรเจกต์').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
	description: z.string().trim().max(300, 'คำอธิบายยาวเกิน 300 ตัวอักษร'),
	icon: z.string().trim().max(60, 'ชื่อไอคอนยาวเกิน 60 ตัวอักษร'),
	instructions: z.string().trim().max(8000, 'คำสั่งยาวเกิน 8000 ตัวอักษร')
});
