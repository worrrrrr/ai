<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Square from '@lucide/svelte/icons/square';

	/** สัญญาขั้นต่ำที่ Composer ต้องใช้จาก Chat ของ AI SDK (จึงเทสต์ได้ด้วยของปลอม) */
	type ChatLike = {
		readonly status: string;
		sendMessage: (message: { text: string }) => Promise<void> | void;
		stop?: () => void;
	};

	let {
		chat,
		placeholder = 'พิมพ์ข้อความ…'
	}: {
		chat: ChatLike;
		placeholder?: string;
	} = $props();

	let value = $state('');
	/** กันการส่งกลางคันระหว่างประกอบคำด้วย IME (สำคัญกับภาษาไทย) */
	let composing = $state(false);

	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	const canSend = $derived(value.trim().length > 0 && !busy);

	async function submit() {
		const text = value.trim();
		if (!text || busy) return;
		value = '';
		await chat.sendMessage({ text });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey) return;
		if (composing || event.isComposing) return;
		event.preventDefault();
		void submit();
	}
</script>

<form
	class="composer-dock px-4 pb-4"
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<div class="chat-column">
		<div
			class="flex items-end gap-2 rounded-panel border border-line bg-surface p-2 shadow-raised transition-colors focus-within:border-edge"
		>
			<textarea
				bind:value
				{placeholder}
				rows={1}
				class="scroll-slim max-h-48 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-ink-muted"
				onkeydown={handleKeydown}
				oncompositionstart={() => (composing = true)}
				oncompositionend={() => (composing = false)}></textarea>

			{#if busy}
				<button
					type="button"
					class="rounded-control bg-ink p-2 text-ink-inverted transition-opacity hover:opacity-90"
					aria-label="หยุดคำตอบ"
					onclick={() => chat.stop?.()}
				>
					<Square size={16} strokeWidth={2} />
				</button>
			{:else}
				<button
					type="submit"
					class="rounded-control bg-brand p-2 text-ink-inverted transition-opacity hover:opacity-90 disabled:opacity-40"
					aria-label="ส่งข้อความ"
					disabled={!canSend}
				>
					<ArrowUp size={16} strokeWidth={2.5} />
				</button>
			{/if}
		</div>
	</div>
</form>
