import { error } from '@sveltejs/kit';
import { loadMessages } from '#lib/server/chats.ts';

export const load = async ({ params, locals }) => {
	const { data: chat } = await locals.supabase
		.from('chats')
		.select('id, title')
		.eq('id', params.id)
		.maybeSingle();

	// RLS จะไม่คืนแถวของคนอื่น จึงกลายเป็น 404 ไปในตัว
	if (!chat) error(404, 'ไม่พบแชทนี้');

	const messages = await loadMessages(locals.supabase, chat.id);

	return { chatId: chat.id, title: chat.title, messages };
};
