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

	/** สถานะของ tool เป็นภาษาไทย (ค่าเดิมจาก AI SDK เช่น output-available) */
	const STATE_LABELS: Record<string, string> = {
		'input-streaming': 'กำลังเตรียม',
		'input-available': 'กำลังทำงาน',
		'output-available': 'เสร็จแล้ว',
		'output-error': 'ผิดพลาด'
	};

	const stateLabel = (state: string) => STATE_LABELS[state] ?? state;

	/** ค่าของ "ขั้นของคำขอ" ที่เซิร์ฟเวอร์แนบมากับคำตอบ (data-route) */
	function routeData(part: LoosePart): Record<string, unknown> {
		return ((part as unknown as { data?: Record<string, unknown> }).data ?? {}) as Record<
			string,
			unknown
		>;
	}

	const routeFailed = (part: LoosePart) => routeData(part).routeFailed === true;

	/** ข้อความหลัก: เลือกกลุ่มอะไรด้วยคะแนนเท่าไร — หรือบอกตรง ๆ ว่า router ใช้ไม่ได้ */
	function routeText(part: LoosePart): string {
		const data = routeData(part);
		if (data.routeFailed === true) return 'ตัวเลือกเครื่องมือใช้ไม่ได้ — ตอบโดยไม่ใช้เครื่องมือ';

		const group = typeof data.group === 'string' ? data.group : 'ไม่ได้ระบุกลุ่ม';
		const score = typeof data.score === 'number' ? ` · คะแนน ${data.score.toFixed(2)}` : '';
		return `กลุ่ม: ${group}${score}`;
	}

	function routeTools(part: LoosePart): string {
		const tools = routeData(part).tools;
		return Array.isArray(tools) && tools.length > 0 ? tools.join(', ') : '';
	}

	function routeMeta(part: LoosePart): string {
		const data = routeData(part);
		const provider = typeof data.provider === 'string' && data.provider ? data.provider : '';
		const model = typeof data.model === 'string' && data.model ? data.model : '';
		return [provider, model].filter(Boolean).join(' · ');
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
					<span class="text-ink-muted"> · {stateLabel(part.state)}</span>
				{/if}
			</summary>
			<pre class="mt-2 scroll-slim overflow-x-auto font-mono text-xs whitespace-pre-wrap">
{JSON.stringify({ input: part.input, output: part.output, error: part.errorText }, null, 2)}</pre>
		</details>
	{:else if part.type === 'data-route'}
		<!-- ขั้นของคำขอ: router เลือกอะไร/คะแนนเท่าไร · เครื่องมือที่ส่ง · โมเดล/ผู้ให้บริการ (แดงเมื่อ router ล้ม) -->
		<div
			class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border px-3 py-1.5 text-[11px]"
			class:border-danger={routeFailed(part)}
			class:border-line={!routeFailed(part)}
		>
			<span class:text-danger={routeFailed(part)} class:text-ink-secondary={!routeFailed(part)}>
				{routeText(part)}
			</span>

			{#if routeTools(part)}
				<span class="text-ink-muted">เครื่องมือ: {routeTools(part)}</span>
			{/if}

			{#if routeMeta(part)}
				<span class="font-mono text-ink-muted">{routeMeta(part)}</span>
			{/if}
		</div>
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
