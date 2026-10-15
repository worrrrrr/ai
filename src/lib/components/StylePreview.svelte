<script lang="ts">
	import { isCssColor, type StylePreset } from '#lib/settings.ts';
	import type { StyleValues } from '#lib/stylePresets.ts';

	let { values }: { values: StyleValues | StylePreset } = $props();

	// บังคับ color-scheme ของกล่อง เพื่อให้ light-dark() ในตัวแปรแสดงผลตามโหมดนั้นจริง ๆ
	const vars = $derived(
		[
			`--brand: light-dark(${values.brandLight}, ${values.brandDark})`,
			`--brand-strong: light-dark(${values.brandStrongLight}, ${values.brandStrongDark})`,
			`--brand-soft: light-dark(${values.brandSoftLight}, ${values.brandSoftDark})`,
			`--panel-radius: ${values.radiusPanel}`,
			`--control-radius: ${values.radiusControl}`
		].join('; ')
	);

	const modes = [
		{ scheme: 'light', label: 'โหมดสว่าง' },
		{ scheme: 'dark', label: 'โหมดมืด' }
	];

	function swatch(value: string): string {
		return isCssColor(value) ? value : 'transparent';
	}
</script>

<div class="grid gap-3 sm:grid-cols-2">
	{#each modes as mode (mode.scheme)}
		<div
			class="rounded-panel border border-line bg-canvas p-3"
			style="color-scheme: {mode.scheme}; {vars}"
		>
			<p class="text-xs text-ink-muted">{mode.label}</p>

			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="rounded-control bg-brand px-2.5 py-1 text-xs text-ink-inverted">ปุ่มหลัก</span>
				<span class="rounded-control bg-brand-strong px-2.5 py-1 text-xs text-ink-inverted"
					>เน้น</span
				>
				<span class="rounded-control bg-brand-soft px-2.5 py-1 text-xs text-ink">ฟองข้อความ</span>
			</div>

			<div
				class="mt-2 rounded-panel border border-line bg-surface px-2 py-1.5 text-xs text-ink-secondary"
			>
				การ์ดตัวอย่าง — มุมโค้งและสีตามที่ตั้งไว้
			</div>

			<div class="mt-2 flex gap-1">
				{#each [values.brandLight, values.brandStrongLight, values.brandSoftLight] as color, index (index)}
					<span
						class="h-4 w-6 rounded-control border border-line"
						style="background: {mode.scheme === 'light'
							? swatch(color)
							: swatch(
									index === 0
										? values.brandDark
										: index === 1
											? values.brandStrongDark
											: values.brandSoftDark
								)}"
					></span>
				{/each}
			</div>
		</div>
	{/each}
</div>
