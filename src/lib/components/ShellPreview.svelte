<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { settingsStyle, type StylePreset, type UserSettings } from '#lib/settings.ts';

	/**
	 * ตัวอย่างเปลือกแอป "จากของจริง" — ไม่ใช่ภาพ และไม่สร้างข้อความสมมติ
	 * - โครง/สี/มุม/ด้าน/ความหนาแน่น/สเกล มาจาก token ชุดเดียวกับ `layout.css`
	 * - รายการด้านข้างเป็น "ชื่อแชทจริง" ของผู้ใช้ (ดู docs/ui-ux.md §3)
	 * `font-size` ที่ตัวครอบทำให้เห็นผลของ `--font-scale` ด้วย (rem อ้างราก จึงไม่ขยับตาม)
	 */
	let {
		settings,
		style = null,
		modes = ['light', 'dark'],
		chatTitles = []
	}: {
		settings: UserSettings;
		style?: StylePreset | null;
		modes?: ('light' | 'dark')[];
		/** ชื่อแชทจริงของผู้ใช้ (ใหม่ -> เก่า) — ส่งว่างได้ถ้ายังไม่มีแชท */
		chatTitles?: string[];
	} = $props();

	const modeLabel = { light: 'โหมดสว่าง', dark: 'โหมดมืด' } as const;
	const navItems = ['แชท', 'เอเจนต์', 'โปรเจกต์'];

	const recent = $derived(chatTitles.filter((title) => title.trim()).slice(0, 3));
	const headline = $derived(recent[0] ?? 'แชทใหม่');
</script>

<div class="grid gap-3" class:sm:grid-cols-2={modes.length > 1}>
	{#each modes as mode (mode)}
		<div class="overflow-hidden rounded-panel border border-line">
			<div
				style="color-scheme: {mode}; font-size: calc(0.9rem * var(--font-scale, 1)); {settingsStyle(
					settings,
					false,
					style
				)}"
			>
				<div class="grid" style="grid-template-columns: var(--shell-columns)">
					<div
						class="min-w-0 border-line bg-surface p-2"
						class:border-e={settings.sidebarSide === 'left'}
						class:border-s={settings.sidebarSide === 'right'}
						style="order: var(--sidebar-order)"
					>
						<div class="flex items-center gap-1 text-ink-secondary">
							<Sparkles size={12} strokeWidth={1.75} />
							<span class="text-[11px] font-semibold">ai</span>
						</div>

						<div class="mt-2 flex flex-col gap-1">
							{#each navItems as item, index (item)}
								<span
									class="rounded-control px-1.5 py-0.5 text-[10px]"
									class:bg-hover={index === 0}
									class:text-ink={index === 0}
									class:text-ink-muted={index > 0}>{item}</span
								>
							{/each}
						</div>

						<div class="mt-2 flex flex-col gap-1 border-t border-line pt-2">
							{#if recent.length === 0}
								<span class="px-1.5 text-[10px] text-ink-muted">ยังไม่มีแชท</span>
							{:else}
								{#each recent as title, index (title)}
									<span
										class="truncate px-1.5 py-0.5 text-[10px]"
										class:text-ink={index === 0}
										class:text-ink-muted={index > 0}>{title}</span
									>
								{/each}
							{/if}
						</div>
					</div>

					<div class="min-w-0 bg-canvas p-2" style="order: var(--content-order)">
						<div
							class="mx-auto flex flex-col"
							style="max-width: var(--column-max); gap: calc(0.5rem * var(--density))"
						>
							<p class="truncate text-[10px] font-medium text-ink-secondary">{headline}</p>

							<!-- พื้นที่ข้อความ: แสดงเป็นกรอบว่าง ไม่ใส่ข้อความสมมติ -->
							<div
								class="flex min-h-16 items-center justify-center rounded-panel border border-dashed border-line bg-surface px-2 py-3"
							>
								<span class="text-[10px] text-ink-muted">พื้นที่ข้อความ</span>
							</div>

							<div
								class="flex items-center gap-1 rounded-control border border-line bg-surface px-2 py-1"
							>
								<span class="text-[10px] text-ink-muted">พิมพ์ข้อความ…</span>
								<span
									class="ms-auto flex items-center rounded-control bg-brand px-1.5 py-0.5 text-ink-inverted"
								>
									<svg
										viewBox="0 0 24 24"
										width="9"
										height="9"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M12 19V5" />
										<path d="m5 12 7-7 7 7" />
									</svg>
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<p class="border-t border-line px-2 py-1 text-[10px] text-ink-muted">{modeLabel[mode]}</p>
		</div>
	{/each}
</div>
