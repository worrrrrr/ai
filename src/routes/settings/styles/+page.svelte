<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';
	import ShellPreview from '#lib/components/ShellPreview.svelte';
	import { page } from '$app/state';

	/** ชื่อแชทจริง (จาก data ของ layout แม่) — ตัวอย่างเปลือกจะได้ไม่ต้องใช้ข้อความสมมติ */
	const chatTitles = $derived(
		((page.data.chats ?? []) as { title: string | null }[]).map((chat) => chat.title ?? '')
	);
	import StyleFields from '#lib/components/StyleFields.svelte';
	import StyleRowEditor from '#lib/components/StyleRowEditor.svelte';
	import type { StylePreset } from '#lib/settings.ts';
	import { settingsStyle } from '#lib/settings.ts';
	import {
		defaultStyleValues,
		templateValues,
		type StyleTemplate,
		type StyleValues
	} from '#lib/stylePresets.ts';

	let { data, form } = $props();

	// แบบ VS Code: กดแล้วมีผลทันที — ฟอร์มลับด้านล่างยิงไปใช้สไตล์ที่เพิ่งกด
	const enhanceAll: SubmitFunction =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: true });
		};

	let applyForm = $state<HTMLFormElement | null>(null);

	type Row = {
		kind: 'mine' | 'template';
		key: string;
		name: string;
		description: string;
		values: StyleValues;
		active: boolean;
		/** มีเฉพาะสไตล์ที่บันทึกไว้ (ใช้กับฟอร์มแก้ไข/ลบ) */
		style?: StylePreset;
	};

	function valuesOf(style: StylePreset): StyleValues {
		return {
			brandLight: style.brandLight,
			brandDark: style.brandDark,
			brandStrongLight: style.brandStrongLight,
			brandStrongDark: style.brandStrongDark,
			brandSoftLight: style.brandSoftLight,
			brandSoftDark: style.brandSoftDark,
			radiusPanel: style.radiusPanel,
			radiusControl: style.radiusControl
		};
	}

	const rows = $derived<Row[]>([
		...(data.styles as StylePreset[]).map((style) => ({
			kind: 'mine' as const,
			key: style.id,
			name: style.name,
			description: 'สไตล์ของฉัน',
			values: valuesOf(style),
			active: style.isActive,
			style
		})),
		...data.templates.map((template: StyleTemplate) => ({
			kind: 'template' as const,
			key: template.id,
			name: template.name,
			description: template.description,
			values: templateValues(template),
			active: data.styles.some(
				(style: StylePreset) => style.isActive && style.name === template.name
			)
		}))
	]);

	let search = $state('');
	let source = $state<'all' | 'mine' | 'template'>('all');

	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		rows
			.filter((row) => source === 'all' || row.kind === source)
			.filter(
				(row) =>
					query === '' ||
					row.name.toLowerCase().includes(query) ||
					row.description.toLowerCase().includes(query)
			)
	);

	// เลือกดูตัวอย่างก่อน (ยังไม่บันทึก) — คลิกในรายการซ้ายแล้วตัวอย่างขวาเปลี่ยนทันที
	let pickedKey = $state<string | null>(null);
	// "เลื่อนผ่าน" ด้วยเมาส์หรือ Tab = เปลี่ยนตัวอย่างทันที (ยังไม่ใช้จริงจนกด)
	let hoveredKey = $state<string | null>(null);

	const selected = $derived(filtered.find((row) => row.key === pickedKey) ?? filtered[0] ?? null);
	const previewed = $derived(filtered.find((row) => row.key === hoveredKey) ?? selected ?? null);

	const previewPreset = $derived<StylePreset | null>(
		previewed
			? { id: previewed.key, name: previewed.name, ...previewed.values, isActive: previewed.active }
			: null
	);

	// โหมด "สร้าง/แก้เอง": ฟอร์มอยู่ฝั่งขวา ไม่กินพื้นที่หน้า
	let custom = $state(false);
	let draft = $state<StyleValues>({ ...defaultStyleValues });
	let customName = $state('');

	function copyToCustom(values: StyleValues, name: string) {
		draft = { ...values };
		customName = name;
		custom = true;
	}

	/**
	 * กดรายการแล้ว "ใช้ทันที" (แบบ VS Code / OpenAI) — ไม่ต้องกดปุ่มยืนยันอีก
	 * ต้องรอ tick() ให้ DOM อัปเดต action/ค่าที่ซ่อนของฟอร์มลับก่อน จึงสั่ง submit ได้
	 */
	async function pickRow(row: Row) {
		pickedKey = row.key;
		custom = false;
		await tick();
		applyForm?.requestSubmit();
	}

	function swatches(values: StyleValues): string[] {
		return [values.brandLight, values.brandStrongLight, values.brandDark];
	}
</script>

<div
	class="flex min-h-0 flex-1 flex-col gap-3 rounded-panel"
	style={settingsStyle(data.settings, false, previewPreset)}
>
	{#if form?.message}
		<SettingsAlert message={form.message} />
	{/if}
	{#if form?.ok}
		<SettingsAlert kind="success" message={form.ok} />
	{/if}
	{#if data.listError}
		<SettingsAlert message={data.listError} />
	{/if}

	<!-- ฟอร์มลับ: ยิงไปใช้สไตล์ทันทีเมื่อกดรายการด้านซ้าย -->
	<form
		method="POST"
		action={selected?.kind === 'mine' ? '?/use' : '?/apply'}
		use:enhance={enhanceAll}
		bind:this={applyForm}
		class="hidden"
	>
		<input
			type="hidden"
			name="template"
			value={selected?.kind === 'template' ? selected.key : ''}
		/>
		<input type="hidden" name="id" value={selected?.kind === 'mine' ? selected.key : ''} />
	</form>

	<div class="flex min-h-0 flex-1 gap-4">
		<!-- กรอบซ้าย: รายการ (เลื่อนเฉพาะในกรอบนี้ ไม่ลากทั้งหน้า) -->
		<aside class="flex w-72 shrink-0 flex-col gap-2 border-e border-line pe-4">
			<input
				bind:value={search}
				placeholder="ค้นหาแม่แบบ/สี…"
				aria-label="ค้นหาสไตล์"
				class="w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge"
			/>

			<div class="flex gap-1">
				{#each [['all', 'ทั้งหมด'], ['mine', 'ของฉัน'], ['template', 'แม่แบบ']] as option (option[0])}
					<button
						type="button"
						onclick={() => (source = option[0] as 'all' | 'mine' | 'template')}
						aria-pressed={source === option[0]}
						class="rounded-control border px-2 py-0.5 text-[11px] transition-colors"
						class:border-brand={source === option[0]}
						class:bg-brand-soft={source === option[0]}
						class:border-line={source !== option[0]}
						class:hover:bg-hover={source !== option[0]}
					>
						{option[1]}
					</button>
				{/each}
			</div>

			<p class="text-[10px] text-ink-muted">เลื่อนเมาส์/กด Tab = ดูตัวอย่าง · คลิก = ใช้จริง</p>

			<ul
				class="flex scroll-slim min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
				onmouseleave={() => (hoveredKey = null)}
			>
				{#each filtered as row (row.kind + row.key)}
					<li>
						<button
							type="button"
							onclick={() => {
								pickRow(row);
							}}
							onmouseenter={() => (hoveredKey = row.key)}
							onfocus={() => (hoveredKey = row.key)}
							onblur={() => (hoveredKey = null)}
							aria-pressed={selected?.key === row.key}
							class="flex w-full items-center gap-2 rounded-control border px-2 py-1.5 text-left transition-colors"
							class:border-brand={selected?.key === row.key}
							class:bg-brand-soft={selected?.key === row.key}
							class:border-line={selected?.key !== row.key}
							class:hover:bg-hover={selected?.key !== row.key}
						>
							<span class="flex shrink-0 items-center gap-0.5">
								{#each swatches(row.values) as color, index (index)}
									<span
										class="h-3.5 w-3.5 rounded-full border border-line"
										style="background: {color}"
									></span>
								{/each}
							</span>

							<span class="min-w-0 flex-1 truncate text-xs">{row.name}</span>

							{#if row.kind === 'mine'}
								<span class="shrink-0 rounded-control bg-sunken px-1 text-[10px] text-ink-muted"
									>ของฉัน</span
								>
							{/if}
							{#if row.active}
								<span class="shrink-0 rounded-control bg-brand-soft px-1 text-[10px] text-ink"
									>ใช้อยู่</span
								>
							{/if}
						</button>
					</li>
				{/each}

				{#if filtered.length === 0}
					<li class="px-2 py-1 text-xs text-ink-muted">ไม่พบสไตล์ที่ค้นหา</li>
				{/if}
			</ul>

			<button
				type="button"
				onclick={() => {
					custom = true;
					pickedKey = null;
				}}
				class="flex items-center justify-center gap-1 rounded-control border border-line px-2 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover"
			>
				<Plus size={14} strokeWidth={1.75} />
				สร้างสไตล์เอง
			</button>
		</aside>

		<!-- กรอบขวา: ตัวอย่างของจริง + ฟอร์ม -->
		<section class="flex scroll-slim min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
			{#if custom}
				<SettingsPanel
					title="สร้าง/แก้สไตล์เอง"
					description="เลือกสีหลักแล้วระบบคำนวณที่เหลือให้ หรือกำหนดทีละค่าใน “ขั้นสูง”"
				>
					<form method="POST" action="?/create" class="flex flex-col gap-4">
						<label class="flex items-center gap-2 text-xs">
							<span class="w-16 shrink-0 text-ink-muted">ชื่อสไตล์</span>
							<input
								name="name"
								bind:value={customName}
								placeholder="สไตล์ของฉัน"
								required
								maxlength="60"
								class="min-w-0 flex-1 rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge"
							/>
						</label>

						<StyleFields bind:values={draft} />
						<ShellPreview settings={data.settings} style={previewPreset} {chatTitles} />

						<div class="flex flex-wrap gap-2">
							<button
								type="submit"
								class="rounded-control bg-brand px-4 py-2 text-sm text-ink-inverted transition-colors hover:bg-brand-strong"
							>
								บันทึกสไตล์นี้
							</button>
							<button
								type="button"
								onclick={() => (custom = false)}
								class="rounded-control border border-line px-3 py-2 text-xs text-ink-secondary transition-colors hover:bg-hover"
							>
								ย้อนกลับไปดูรายการ
							</button>
						</div>
					</form>
				</SettingsPanel>
			{:else if selected}
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm font-medium">{selected.name}</p>
					<span class="rounded-control bg-sunken px-1.5 py-0.5 text-[11px] text-ink-muted">
						{selected.description}
					</span>
					{#if selected.active}
						<span class="rounded-control bg-brand-soft px-1.5 py-0.5 text-[11px] text-ink"
							>ใช้อยู่</span
						>
					{/if}

					<div class="ms-auto flex flex-wrap items-center gap-2">
						{#if selected.kind === 'template'}
							<form method="POST" action="?/apply">
								<input type="hidden" name="template" value={selected.key} />
								<button
									type="submit"
									class="rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
								>
									ใช้สไตล์นี้
								</button>
							</form>
							<button
								type="button"
								onclick={() => copyToCustom(selected.values, selected.name)}
								class="rounded-control border border-line px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover"
							>
								คัดลอกมาแก้
							</button>
						{:else}
							{#if !selected.active}
								<form method="POST" action="?/use">
									<input type="hidden" name="id" value={selected.key} />
									<button
										type="submit"
										class="rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
									>
										ใช้สไตล์นี้
									</button>
								</form>
							{/if}
							<form method="POST" action="?/delete">
								<input type="hidden" name="id" value={selected.key} />
								<button
									type="submit"
									class="flex items-center gap-1 rounded-control px-2 py-1.5 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
								>
									<Trash2 size={14} strokeWidth={1.75} />
									ลบ
								</button>
							</form>
						{/if}
					</div>
				</div>

				<ShellPreview settings={data.settings} style={previewPreset} {chatTitles} />

				{#if selected.style}
					<StyleRowEditor style={selected.style} />
				{/if}
			{:else}
				<p class="text-sm text-ink-muted">ยังไม่มีสไตล์ — เริ่มจาก “สร้างสไตล์เอง” ได้เลย</p>
			{/if}
		</section>
	</div>
</div>
