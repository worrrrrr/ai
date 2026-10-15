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

	/**
	 * บรรทัด "ใครตอบ · ใช้เวลาเท่าไร" จาก metadata ที่โหลดมาจากฐานข้อมูล
	 * แสดงเฉพาะเมื่อไม่มีขั้นของคำขอสด (data-route) อยู่แล้ว — กันข้อความซ้ำสองบรรทัด
	 */
	const metaLine = $derived.by(() => {
		if (message.parts.some((part) => part.type === 'data-route')) return '';

		const metadata = (
			message as unknown as {
				metadata?: { model?: string; provider?: string; durationMs?: number | null };
			}
		).metadata;
		if (!metadata) return '';

		const seconds =
			typeof metadata.durationMs === 'number'
				? `${(metadata.durationMs / 1000).toFixed(1)} วิ`
				: '';

		return [metadata.provider, metadata.model, seconds].filter(Boolean).join(' · ');
	});

	async function copy() {
		if (!plainText) return;
		await navigator.clipboard.writeText(plainText);
	}
</script>

<article class="group flex flex-col gap-1.5" class:items-end={isUser}>
	<div class="flex items-center gap-2 text-xs text-ink-muted">
		<span>{roleLabel}</span>
	</div>

	<div
		class="w-full rounded-panel border px-3 py-2"
		class:max-w-[85%]={isUser}
		class:border-transparent={isUser}
		class:border-line={!isUser}
		class:bg-brand-soft={isUser}
		class:bg-surface={!isUser}
	>
		<MessageParts {message} />
	</div>

	<!-- ท้ายข้อความ: บรรทัด "ใครตอบ · ใช้เวลาเท่าไร" (จาก metadata) + ปุ่มคัดลอก -->
	{#if plainText || metaLine}
		<div class="flex items-center gap-2" class:justify-end={isUser}>
			{#if !isUser && metaLine}
				<span class="font-mono text-[10px] text-ink-muted">{metaLine}</span>
			{/if}

			{#if plainText}
				<button
					type="button"
					class="rounded-control p-1 text-ink-muted opacity-40 transition-opacity group-hover:opacity-100 hover:bg-hover hover:text-ink hover:opacity-100 focus-visible:opacity-100"
					aria-label="คัดลอกข้อความ"
					title="คัดลอก"
					onclick={copy}
				>
					<Copy size={13} strokeWidth={1.75} />
				</button>
			{/if}
		</div>
	{/if}
</article>
