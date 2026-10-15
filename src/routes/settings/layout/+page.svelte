<script lang="ts">
	import AArrowDown from '@lucide/svelte/icons/a-arrow-down';
	import AArrowUp from '@lucide/svelte/icons/a-arrow-up';
	import AlignCenter from '@lucide/svelte/icons/align-center';
	import AlignVerticalSpaceBetween from '@lucide/svelte/icons/align-vertical-space-between';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import List from '@lucide/svelte/icons/list';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import Moon from '@lucide/svelte/icons/moon';
	import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import PanelRight from '@lucide/svelte/icons/panel-right';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import Rows4 from '@lucide/svelte/icons/rows-4';
	import StretchHorizontal from '@lucide/svelte/icons/stretch-horizontal';
	import Sun from '@lucide/svelte/icons/sun';
	import SunMoon from '@lucide/svelte/icons/sun-moon';
	import Type from '@lucide/svelte/icons/type';
	import UnfoldVertical from '@lucide/svelte/icons/unfold-vertical';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { untrack } from 'svelte';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';
	import ShellPreview from '#lib/components/ShellPreview.svelte';
	import { page } from '$app/state';

	/** ชื่อแชทจริง (จาก data ของ layout แม่) — ใช้ในตัวอย่างเปลือกแทนข้อความสมมติ */
	const chatTitles = $derived(
		((page.data.chats ?? []) as { title: string | null }[]).map((chat) => chat.title ?? '')
	);
	import {
		columnMaxChoices,
		densityChoices,
		fontScaleChoices,
		layoutPresets,
		matchesLayoutPreset,
		sidebarCollapsibleChoices,
		sidebarSideChoices,
		sidebarVariantChoices,
		sidebarWidthChoices,
		themeChoices,
		type LayoutPreset,
		type ThemeChoice,
		type UserSettings
	} from '#lib/settings.ts';

	let { data, form } = $props();

	// แบบ VS Code: กดแล้วมีผลทันที — ทุกการเปลี่ยนค่าจะ submit ฟอร์มเอง
	// enhance + invalidateAll ทำให้ข้อมูลโหลดใหม่โดยไม่ต้องรีเฟรชหน้า (เปลือกแอปอัปเดตตาม)
	const enhanceAll: SubmitFunction =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: true });
		};

	let formEl = $state<HTMLFormElement | null>(null);

	function saveNow() {
		formEl?.requestSubmit();
	}

	// ค่าที่กำลังแก้ (ยังไม่บันทึก) — ตัวอย่างและธีมของหน้าจอเปลี่ยนตามทันที
	// untrack: ตั้งต้นจากค่าที่บันทึกไว้ครั้งเดียว ไม่ต้องตาม data ใหม่ทุกครั้ง
	const initial = untrack(() => ({ ...data.settings }));

	let theme = $state<string>(initial.theme);
	let sidebarWidth = $state(initial.sidebarWidth);
	let sidebarSide = $state(initial.sidebarSide);
	let sidebarVariant = $state(initial.sidebarVariant);
	let sidebarCollapsible = $state(initial.sidebarCollapsible);
	let density = $state(initial.density);
	let columnMax = $state(initial.columnMax);
	let fontScale = $state(initial.fontScale);
	let collapsed = $state(initial.sidebarCollapsed);

	$effect(() => {
		// ให้เห็นผลทันทีตอนเลือก — ค่าจะถูกบันทึกจริงเมื่อกด "บันทึกค่า"
		const resolved =
			theme === 'auto'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: theme;
		document.documentElement.dataset.theme = resolved;
		document.documentElement.dataset.themeChoice = theme;
	});

	/** สัดส่วนปัจจุบัน (ไม่รวมธีม) — ใช้เทียบว่าตรงกับชุดสำเร็จรูปไหน */
	const structure = $derived({
		sidebarWidth,
		density,
		columnMax,
		sidebarCollapsed: collapsed,
		sidebarSide,
		sidebarVariant,
		sidebarCollapsible,
		fontScale
	});

	const liveSettings = $derived<UserSettings>({
		theme: theme as ThemeChoice,
		sidebarWidth,
		density,
		columnMax,
		sidebarCollapsed: collapsed,
		sidebarSide,
		sidebarVariant,
		sidebarCollapsible,
		fontScale
	});

	const activePreset = $derived(
		layoutPresets.find((preset) => matchesLayoutPreset(structure, preset)) ?? null
	);

	function applyPreset(preset: LayoutPreset) {
		sidebarWidth = preset.values.sidebarWidth;
		density = preset.values.density;
		columnMax = preset.values.columnMax;
		collapsed = preset.values.sidebarCollapsed;
		sidebarSide = preset.values.sidebarSide;
		fontScale = preset.values.fontScale;
	}

	/** แผ่นไอคอนหนึ่งแผ่น */
	type Tile = { label: string; hint: string; icon: typeof Sun; value: string | number };
	type Axis = {
		label: string;
		tiles: Tile[];
		active: (tile: Tile) => boolean;
		pick: (value: string | number) => void;
	};

	// ไอคอนเรียงตามลำดับของตัวเลือกใน #lib/settings.ts
	const themeIcons = [Sun, Moon, SunMoon];
	const sideIcons = [PanelLeft, PanelRight];
	const variantIcons = [PanelLeft, LayoutDashboard, Columns3];
	const collapsibleIcons = [PanelLeftClose, AlignVerticalSpaceBetween, Maximize2];
	const widthIcons = [PanelLeftClose, PanelLeft, PanelLeftOpen, MoveHorizontal, Maximize2];
	const densityIcons = [Rows4, Rows3, List, UnfoldVertical, AlignVerticalSpaceBetween];
	const columnIcons = [Minimize2, AlignCenter, StretchHorizontal, LayoutDashboard, Columns3];
	const scaleIcons = [AArrowDown, Type, AArrowUp];

	/** หัวข้อกลุ่มของแกน — ผูกกับ "ตำแหน่ง" ในอาร์เรย์ด้านล่าง (จึงไม่ต้องสลับลำดับแกน)
	 *  0-2 โครงและธีม · 3-6 สัดส่วน · 7-8 การย่อ */
	const AXIS_GROUPS: { from: number; title: string }[] = [
		{ from: 0, title: 'โครงและธีม' },
		{ from: 3, title: 'สัดส่วน' },
		{ from: 7, title: 'การย่อ' }
	];

	const axisGroupTitle = (index: number) =>
		AXIS_GROUPS.find((group) => group.from === index)?.title ?? '';

	const axes = $derived<Axis[]>([
		{
			label: 'ธีม',
			tiles: themeChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value,
				icon: themeIcons[index] ?? Sun,
				value: choice.value
			})),
			active: (tile) => theme === tile.value,
			pick: (value) => (theme = String(value))
		},
		{
			label: 'ด้าน',
			tiles: sidebarSideChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value === 'left' ? 'ซ้าย' : 'ขวา',
				icon: sideIcons[index] ?? PanelLeft,
				value: choice.value
			})),
			active: (tile) => sidebarSide === tile.value,
			pick: (value) => (sidebarSide = value === 'right' ? 'right' : 'left')
		},
		{
			label: 'รูปแบบ',
			tiles: sidebarVariantChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value,
				icon: variantIcons[index] ?? PanelLeft,
				value: choice.value
			})),
			active: (tile) => sidebarVariant === tile.value,
			pick: (value) => {
				sidebarVariant = value as 'sidebar' | 'floating' | 'inset';
			}
		},
		{
			label: 'ความกว้าง',
			tiles: sidebarWidthChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value,
				icon: widthIcons[index] ?? PanelLeft,
				value: choice.value
			})),
			active: (tile) => sidebarWidth === tile.value,
			pick: (value) => (sidebarWidth = String(value))
		},
		{
			label: 'หนาแน่น',
			tiles: densityChoices.map((choice, index) => ({
				label: choice.label,
				hint: String(choice.value),
				icon: densityIcons[index] ?? List,
				value: choice.value
			})),
			active: (tile) => density === tile.value,
			pick: (value) => (density = Number(value))
		},
		{
			label: 'คอลัมน์',
			tiles: columnMaxChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value,
				icon: columnIcons[index] ?? AlignCenter,
				value: choice.value
			})),
			active: (tile) => columnMax === tile.value,
			pick: (value) => (columnMax = String(value))
		},
		{
			label: 'สเกลจอ',
			tiles: fontScaleChoices.map((choice, index) => ({
				label: choice.label,
				hint: `${Math.round(choice.value * 100)}%`,
				icon: scaleIcons[index] ?? Type,
				value: choice.value
			})),
			active: (tile) => fontScale === tile.value,
			pick: (value) => (fontScale = Number(value))
		},
		{
			label: 'เริ่มต้น',
			tiles: [
				{ label: 'ย่อแถบไว้', hint: 'collapsed', icon: PanelLeftClose, value: 'collapsed' },
				{ label: 'ขยายแถบไว้', hint: 'expanded', icon: PanelLeftOpen, value: 'expanded' }
			],
			active: (tile) => (tile.value === 'collapsed' ? collapsed : !collapsed),
			pick: (value) => (collapsed = value === 'collapsed')
		},
		{
			label: 'การย่อ',
			tiles: sidebarCollapsibleChoices.map((choice, index) => ({
				label: choice.label,
				hint: choice.value,
				icon: collapsibleIcons[index] ?? PanelLeftClose,
				value: choice.value
			})),
			active: (tile) => sidebarCollapsible === tile.value,
			pick: (value) => {
				sidebarCollapsible = value as 'offcanvas' | 'icon' | 'none';
			}
		}
	]);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
	{#if form?.message}
		<SettingsAlert message={form.message} />
	{/if}
	{#if form?.ok}
		<SettingsAlert kind="success" message={form.ok} />
	{/if}
	{#if form && 'warning' in form}
		<SettingsAlert kind="info" message={`บันทึกไม่ครบ: ${form.warning}`} />
	{/if}
	{#if data.settingsError}
		<SettingsAlert message={data.settingsError} />
	{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={enhanceAll}
		bind:this={formEl}
		class="flex min-h-0 flex-1 gap-4"
	>
		<!-- แผ่นไอคอนไม่ส่งค่าเอง จึงส่งค่าด้วย input ซ่อน -->
		<input type="hidden" name="theme" value={theme} />
		<input type="hidden" name="sidebar_side" value={sidebarSide} />
		<input type="hidden" name="sidebar_variant" value={sidebarVariant} />
		<input type="hidden" name="sidebar_collapsible" value={sidebarCollapsible} />
		<input type="hidden" name="font_scale" value={fontScale} />
		<input type="hidden" name="sidebar_collapsed" value={collapsed ? 'on' : ''} />

		<!-- กรอบซ้าย: ชุดสำเร็จรูป + แกนแยก (เลื่อนเฉพาะในกรอบนี้) -->
		<aside
			class="flex scroll-slim w-72 shrink-0 flex-col gap-3 overflow-y-auto border-e border-line pe-4"
		>
			<div class="flex flex-col gap-1">
				<p class="text-[11px] font-medium text-ink-secondary">ชุดสำเร็จรูป (ทั้งโครง)</p>

				{#each layoutPresets as preset (preset.id)}
					{@const isActive = activePreset?.id === preset.id}
					<button
						type="button"
						onclick={() => {
							applyPreset(preset);
							saveNow();
						}}
						aria-pressed={isActive}
						class="flex flex-col items-start rounded-control border px-2 py-1.5 text-left transition-colors"
						class:border-brand={isActive}
						class:bg-brand-soft={isActive}
						class:border-line={!isActive}
						class:hover:bg-hover={!isActive}
					>
						<span class="flex w-full items-center gap-2 text-xs">
							{preset.name}
							{#if isActive}
								<span class="rounded-control bg-surface px-1 text-[10px] text-ink">ใช้อยู่</span>
							{/if}
						</span>
						<span class="text-[10px] text-ink-muted">{preset.description}</span>
					</button>
				{/each}
			</div>

			<div class="flex flex-col gap-2 border-t border-line pt-3">
				<p class="text-[11px] font-medium text-ink-secondary">แกนแยก</p>

				{#each axes as axis, index (axis.label)}
					{#if axisGroupTitle(index)}
						<p class="mt-2 w-full text-[11px] font-medium text-ink-secondary">
							{axisGroupTitle(index)}
						</p>
					{/if}

					<div class="flex items-start gap-2">
						<span class="w-16 shrink-0 pt-1.5 text-[11px] text-ink-muted">{axis.label}</span>
						<div class="flex flex-wrap gap-1">
							{#each axis.tiles as tile (tile.value)}
								<button
									type="button"
									onclick={() => {
										axis.pick(tile.value);
										saveNow();
									}}
									aria-pressed={axis.active(tile)}
									aria-label="{axis.label}: {tile.label}"
									title="{tile.label} · {tile.hint}"
									class="flex h-8 w-8 items-center justify-center rounded-control border transition-colors"
									class:border-brand={axis.active(tile)}
									class:bg-brand-soft={axis.active(tile)}
									class:border-line={!axis.active(tile)}
									class:hover:bg-hover={!axis.active(tile)}
								>
									<tile.icon size={16} strokeWidth={1.6} />
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<details class="rounded-panel border border-line bg-sunken p-2" onchange={saveNow}>
				<summary class="cursor-pointer text-[11px] text-ink-secondary">พิมพ์ค่าเอง (rem/px)</summary
				>

				<div class="mt-2 flex flex-col gap-2 text-[11px]">
					<label class="flex items-center gap-2">
						<span class="w-16 shrink-0 text-ink-muted">ความกว้าง</span>
						<input
							name="sidebar_width"
							bind:value={sidebarWidth}
							spellcheck="false"
							class="w-20 rounded-control border border-line bg-transparent px-1.5 py-0.5 font-mono text-[11px] focus:border-edge"
						/>
					</label>
					<label class="flex items-center gap-2">
						<span class="w-16 shrink-0 text-ink-muted">หนาแน่น</span>
						<input
							type="number"
							name="density"
							bind:value={density}
							step="0.05"
							min="0.5"
							max="2"
							class="w-20 rounded-control border border-line bg-transparent px-1.5 py-0.5 font-mono text-[11px] focus:border-edge"
						/>
					</label>
					<label class="flex items-center gap-2">
						<span class="w-16 shrink-0 text-ink-muted">คอลัมน์</span>
						<input
							name="column_max"
							bind:value={columnMax}
							spellcheck="false"
							class="w-20 rounded-control border border-line bg-transparent px-1.5 py-0.5 font-mono text-[11px] focus:border-edge"
						/>
					</label>
					<label class="flex items-center gap-2">
						<span class="w-16 shrink-0 text-ink-muted">สเกล</span>
						<input
							type="number"
							name="font_scale"
							bind:value={fontScale}
							step="0.05"
							min="0.8"
							max="1.3"
							class="w-20 rounded-control border border-line bg-transparent px-1.5 py-0.5 font-mono text-[11px] focus:border-edge"
						/>
					</label>
				</div>
			</details>
		</aside>

		<!-- กรอบขวา: ตัวอย่างของจริง -->
		<section class="flex scroll-slim min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
			<ShellPreview settings={liveSettings} {chatTitles} />

			<p class="text-[11px] text-ink-muted">
				กดแล้วมีผลทันที (บันทึกอัตโนมัติ) — ตัวอย่างนี้ใช้ token ชุดเดียวกับแอปจริง
			</p>
		</section>
	</form>

	<form method="POST" action="?/reset" use:enhance={enhanceAll} class="flex shrink-0">
		<button
			type="submit"
			class="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
		>
			<RotateCcw size={14} strokeWidth={1.75} />
			ล้างค่า กลับไปใช้ค่าตั้งต้น
		</button>
	</form>
</div>
