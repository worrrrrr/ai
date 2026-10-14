import { redirect } from '@sveltejs/kit';

// หน้าแรกพาไปที่รายการแชท เพราะแชทที่บันทึกไว้ต้องมี URL ของตัวเอง (/chat/[id])
export const load = async () => {
	redirect(303, '/chat');
};
