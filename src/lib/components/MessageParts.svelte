<script lang="ts">
	import type { UIMessage } from 'ai';

	type LoosePart = {
		type: string;
		text?: string;
		state?: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
	};

	let { message }: { message: UIMessage } = $props();

	/** ชื่อ tool ที่อ่านออก: "tool-weather" -> "weather" (ยังไม่รู้จัก tool ก็แสดงได้) */
	function toolName(type: string): string {
		return type.startsWith('tool-') ? type.slice('tool-'.length) : type;
	}
</script>

{#each message.parts as rawPart, index (index)}
	{@const part = rawPart as unknown as LoosePart}

	{#if part.type === 'text'}
		<div class="message-prose whitespace-pre-wrap">{part.text}</div>
	{:else if part.type === 'reasoning'}
		<details
			class="rounded-control border border-line bg-sunken px-3 py-2 text-sm text-ink-secondary"
		>
			<summary class="cursor-pointer select-none">การคิดของโมเดล</summary>
			<pre class="mt-2 font-mono text-xs whitespace-pre-wrap">{part.text ?? ''}</pre>
		</details>
	{:else if part.type.startsWith('tool-')}
		<details class="rounded-control border border-line bg-sunken px-3 py-2 text-sm">
			<summary class="cursor-pointer text-ink-secondary select-none">
				ใช้เครื่องมือ <span class="font-mono text-ink">{toolName(part.type)}</span>
				{#if part.state}
					<span class="text-ink-muted"> · {part.state}</span>
				{/if}
			</summary>
			<pre class="mt-2 scroll-slim overflow-x-auto font-mono text-xs whitespace-pre-wrap">
{JSON.stringify({ input: part.input, output: part.output, error: part.errorText }, null, 2)}</pre>
		</details>
	{:else}
		<!-- ส่วนชนิดที่ยังไม่รองรับ: แสดงดิบไว้ ไม่ให้ข้อมูลหายเงียบ ๆ -->
		<details
			class="rounded-control border border-dashed border-line px-3 py-2 text-xs text-ink-muted"
		>
			<summary class="cursor-pointer select-none">ส่วนข้อมูล: {part.type}</summary>
			<pre class="mt-2 scroll-slim overflow-x-auto font-mono whitespace-pre-wrap">{JSON.stringify(
					rawPart,
					null,
					2
				)}</pre>
		</details>
	{/if}
{/each}
