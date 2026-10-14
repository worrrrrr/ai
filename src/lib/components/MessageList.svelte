<script lang="ts">
	import type { UIMessage } from 'ai';
	import Message from './Message.svelte';

	let {
		messages,
		status = 'ready'
	}: {
		messages: UIMessage[];
		status?: string;
	} = $props();

	let scroller: HTMLDivElement | null = $state(null);
	/** ผู้ใช้ยังอยู่ล่างสุดไหม — ถ้าเลื่อนขึ้นไปอ่านย้อนหลัง ไม่ต้องกระโดดลงมา */
	let pinned = $state(true);

	$effect(() => {
		// อ่านค่าเหล่านี้เพื่อให้ effect ทำงานใหม่เมื่อข้อความหรือสถานะเปลี่ยน
		void messages.length;
		void status;
		if (!scroller || !pinned) return;
		scroller.scrollTop = scroller.scrollHeight;
	});

	function handleScroll() {
		if (!scroller) return;
		const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
		pinned = distance < 80;
	}
</script>

<div
	bind:this={scroller}
	class="scroll-slim min-h-0 flex-1 overflow-y-auto"
	onscroll={handleScroll}
>
	<div class="chat-column flex flex-col py-6" style="gap: var(--message-gap)">
		{#each messages as message (message.id)}
			<Message {message} />
		{/each}
	</div>
</div>
