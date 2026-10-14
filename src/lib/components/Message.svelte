<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import type { UIMessage } from 'ai';
	import MessageParts from './MessageParts.svelte';

	let { message }: { message: UIMessage } = $props();

	const isUser = $derived(message.role === 'user');
	const roleLabel = $derived(
		message.role === 'user' ? 'คุณ' : message.role === 'assistant' ? 'ผู้ช่วย' : message.role
	);

	const plainText = $derived(
		message.parts
			.filter((part) => part.type === 'text')
			.map((part) => (part as { text: string }).text)
			.join('\n')
	);

	async function copy() {
		if (!plainText) return;
		await navigator.clipboard.writeText(plainText);
	}
</script>

<article class="flex flex-col gap-1.5" class:items-end={isUser}>
	<div class="flex items-center gap-2 text-xs text-ink-muted">
		<span>{roleLabel}</span>
		{#if plainText}
			<button
				type="button"
				class="rounded-control p-1 transition-colors hover:bg-hover hover:text-ink"
				aria-label="คัดลอกข้อความ"
				onclick={copy}
			>
				<Copy size={13} strokeWidth={1.75} />
			</button>
		{/if}
	</div>

	<div
		class="w-full rounded-panel border px-3 py-2"
		class:border-transparent={isUser}
		class:border-line={!isUser}
		class:bg-brand-soft={isUser}
		class:bg-surface={!isUser}
	>
		<MessageParts {message} />
	</div>
</article>
