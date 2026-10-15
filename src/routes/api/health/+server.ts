import { json } from '@sveltejs/kit';
import { createLogger } from '#lib/server/log.ts';

/**
 * GET /api/health — จุดตรวจสุขภาพสำหรับ uptime monitor
 *
 * - ไม่ต้องล็อกอิน (แต่ไม่เปิดเผยข้อมูลภายใน: ไม่คืนข้อความ error ดิบ ไม่คืนค่า env)
 * - ตอบ 200 เมื่ออ่านฐานข้อมูลได้ · 503 เมื่อไม่พร้อมใช้งาน
 * - บันทึก log **เฉพาะตอนล้มเหลว** (monitor ยิงถี่ — สำเร็จไม่ต้อง log ให้เสียงดัง)
 * - `hooks.server.ts` ปล่อย `/api` ผ่านอยู่แล้ว จึงเข้าถึงได้โดยไม่ถูกเด้งไป /auth
 */
export async function GET({
	locals,
	request,
	platform
}: {
	locals: App.Locals;
	request: Request;
	platform: App.Platform | undefined;
}): Promise<Response> {
	const started = Date.now();
	// ตามรอยเหตุการณ์ของคำขอ: ใช้ header ที่ผู้เรียกส่งมา ถ้าไม่มีก็สร้างใหม่
	const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
	const env = platform?.env as Record<string, string | undefined> | undefined;
	const log = createLogger({ level: env?.LOG_LEVEL });

	// อ่านตารางเบา ๆ หนึ่งครั้ง — RLS อาจคืน 0 แถว ถือว่าฐานข้อมูลตอบปกติ
	const { error } = await locals.supabase.from('profiles').select('id').limit(1);
	const ms = Date.now() - started;

	if (error) {
		log.write(
			'error',
			'ตรวจสุขภาพฐานข้อมูลไม่ผ่าน',
			{ db: 'unavailable', ms, reason: error.code ?? 'unknown' },
			requestId
		);
	}

	return json(
		{
			ok: !error,
			db: error ? 'ไม่พร้อมใช้งาน' : 'ปกติ',
			ms
		},
		{ status: error ? 503 : 200 }
	);
}
