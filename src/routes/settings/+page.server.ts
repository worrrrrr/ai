import { redirect } from '@sveltejs/kit';

// /settings ไม่มีหน้าเปล่า — พาไปหมวดแรกที่ sidebar ลิงก์ไว้
export const load = () => {
	redirect(303, '/settings/providers');
};
