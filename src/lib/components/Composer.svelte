<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Calculator from '@lucide/svelte/icons/calculator';
	import CloudSun from '@lucide/svelte/icons/cloud-sun';
	import Search from '@lucide/svelte/icons/search';
	import Square from '@lucide/svelte/icons/square';
	import X from '@lucide/svelte/icons/x';

	/** สัญญาขั้นต่ำที่ Composer ต้องใช้จาก Chat ของ AI SDK (จึงเทสต์ได้ด้วยของปลอม) */
	type ChatLike = {
		readonly status: string;
		sendMessage: (message: { text: string }, options?: { body?: object }) => Promise<void> | void;
		stop?: () => void;
	};

	/** คำสั่ง `/` — ส่งชื่อ tool ไปกับ body เพื่อบังคับให้ใช้ tool นั้น */
	const COMMANDS = [
		{
			id: 'calculate',
			label: 'คำนวณ',
			hint: 'ใช้เครื่องคิดเลข (parser ปลอดภัย)',
			icon: Calculator
		},
		{ id: 'search', label: 'ค้นหา', hint: 'ค้นข้อมูลจากเว็บจริง', icon: Search },
		{ id: 'weather', label: 'อากาศ', hint: 'อากาศจริงจาก Open-Meteo', icon: CloudSun }
	];

	let {
		chat,
		placeholder = 'พิมพ์ข้อความ…',
		layout = 'dock',
		agentId = '',
		value = $bindable('')
	}: {
		chat: ChatLike;
		placeholder?: string;
		/** dock = ติดล่างในหน้าแชท · hero = กลางจอในหน้าแรก */
		layout?: 'dock' | 'hero';
		/** เอเจนต์ที่เลือกไว้ — แนบไปกับ body ของทุกข้อความที่ส่ง */
		agentId?: string;
		/** bind ได้ เพื่อให้ภายนอกเติมข้อความในช่อง (เช่น กดคำแนะนำ) */
		value?: string;
	} = $props();

	/** กันการส่งกลางคันระหว่างประกอบคำด้วย IME (สำคัญกับภาษาไทย) */
	let composing = $state(false);
	let textareaEl: HTMLTextAreaElement | null = $state(null);
	/** คำสั่งที่เลือกไว้ (chip) — ส่งไปกับข้อความตอนกดส่งเท่านั้น */
	let picked = $state<string[]>([]);
	let menuIndex = $state(0);

	/** เปิดเมนูเมื่อข้อความลงท้ายด้วย "/คำค้น" */
	const menuQuery = $derived(/(?:^|\s)\/(\S*)$/.exec(value)?.[1] ?? null);
	const menuOpen = $derived(menuQuery !== null);
	const menuItems = $derived(
		menuQuery === null
			? []
			: COMMANDS.filter((c) => c.id.startsWith(menuQuery) || c.label.startsWith(menuQuery))
	);
	const activeIndex = $derived(Math.min(menuIndex, Math.max(menuItems.length - 1, 0)));

	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	const canSend = $derived(value.trim().length > 0 && !busy && !menuOpen);

	// เติมข้อความจากภายนอก (เช่น กดคำแนะนำ) แล้วโฟกัสให้แก้/ส่งต่อได้ทันที
	$effect(() => {
		if (value && document.activeElement !== textareaEl) textareaEl?.focus();
	});

	function pick(id: string) {
		if (!picked.includes(id)) picked = [...picked, id];
		// ลบ "/คำค้น" ออกจากข้อความ
		value = value.replace(/(^|\s)\/\S*$/, '$1').replace(/\s+$/, '');
		menuIndex = 0;
		textareaEl?.focus();
	}

	function unpick(id: string) {
		picked = picked.filter((item) => item !== id);
	}

	async function submit() {
		const text = value.trim();
		if (!text || busy || menuOpen) return;

		// body รวมเอเจนต์ (ถ้าเลือกไว้) + คำสั่ง `/` ที่เลือก — ส่งเมื่อกดส่งเท่านั้น
		const body: { commands?: string[]; agentId?: string } = {};
		if (picked.length) body.commands = picked;
		if (agentId) body.agentId = agentId;

		value = '';
		picked = [];
		await chat.sendMessage({ text }, Object.keys(body).length ? { body } : undefined);
	}

	function handleKeydown(event: KeyboardEvent) {
		// เมนูเปิดอยู่: ลูกศร/Enter ใช้เลือกคำสั่ง ไม่ใช่ส่งข้อความ
		if (menuOpen && menuItems.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				menuIndex = (activeIndex + 1) % menuItems.length;
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				menuIndex = (activeIndex - 1 + menuItems.length) % menuItems.length;
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				pick(menuItems[activeIndex].id);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				value = value.replace(/(^|\s)\/\S*$/, '$1');
				return;
			}
		}

		if (event.key !== 'Enter' || event.shiftKey) return;
		if (composing || event.isComposing) return;
		event.preventDefault();
		void submit();
	}
</script>

<form
	class={layout === 'dock' ? 'composer-dock px-4 pb-4' : ''}
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
>
	<div class={layout === 'dock' ? 'chat-column' : ''}>
		{#if menuOpen && menuItems.length > 0}
			<ul class="mb-2 overflow-hidden rounded-panel border border-line bg-surface shadow-popover">
				{#each menuItems as item, index (item.id)}
					{@const Icon = item.icon}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition-colors"
							class:bg-hover={index === activeIndex}
							class:text-ink={index === activeIndex}
							class:text-ink-secondary={index !== activeIndex}
							onclick={() => pick(item.id)}
							onmouseenter={() => (menuIndex = index)}
						>
							<Icon size={16} strokeWidth={1.75} />
							<span class="font-mono">/{item.id}</span>
							<span class="text-ink-muted">{item.hint}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if picked.length > 0}
			<div class="mb-2 flex flex-wrap gap-1.5">
				{#each picked as id (id)}
					{@const command = COMMANDS.find((c) => c.id === id)}
					{#if command}
						{@const Icon = command.icon}
						<span
							title={command.hint}
							class="flex items-center gap-1 rounded-control border border-line bg-sunken px-2 py-0.5 text-xs text-ink-secondary"
						>
							<Icon size={13} strokeWidth={1.75} />
							{command.label}
							<button
								type="button"
								aria-label={`เอา ${command.label} ออก`}
								class="rounded-control p-0.5 transition-colors hover:bg-hover hover:text-ink"
								onclick={() => unpick(id)}
							>
								<X size={12} strokeWidth={2.5} />
							</button>
						</span>
					{/if}
				{/each}
			</div>
		{/if}

		<div
			class="flex items-end gap-2 rounded-panel border border-line bg-surface p-2 shadow-raised transition-colors focus-within:border-edge"
		>
			<textarea
				bind:this={textareaEl}
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
