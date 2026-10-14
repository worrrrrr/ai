<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import Composer from '#lib/components/Composer.svelte';
	import MessageList from '#lib/components/MessageList.svelte';

	let { data } = $props();

	// อ่านค่าตั้งต้นครั้งเดียว (ตั้งใจ ไม่ต้อง reactive) — untrack บอกเจตนานี้กับ compiler
	const { chatId, messages } = untrack(() => data);

	// id ต้องตรงกับแถวในตาราง chats เพื่อให้ /api/chat บันทึกต่อท้ายแชทเดิมได้
	const chat = new Chat({
		id: chatId,
		messages,
		onFinish: () => invalidateAll()
	});
</script>

<header class="flex items-center gap-3 border-b border-line px-4 py-3">
	<h1 class="truncate text-sm font-medium">{data.title}</h1>
	<a class="ms-auto shrink-0 text-xs text-ink-muted transition-colors hover:text-ink" href="/chat">
		รายการแชท
	</a>
</header>

<MessageList messages={chat.messages} status={chat.status} />

<Composer {chat} />
