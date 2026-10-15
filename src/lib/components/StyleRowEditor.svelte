<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { untrack } from 'svelte';
	import type { StylePreset } from '#lib/settings.ts';
	import type { StyleValues } from '#lib/stylePresets.ts';
	import StyleFields from './StyleFields.svelte';
	import StylePreview from './StylePreview.svelte';

	let { style }: { style: StylePreset } = $props();

	// ค่าที่กำลังแก้ (ยังไม่บันทึก) — preview ด้านล่างสะท้อนค่านี้ทันที
	// untrack: อ่านค่าเริ่มต้นครั้งเดียวโดยตั้งใจ ไม่ต้องตามค่าใหม่จาก props
	const initial = untrack(() => ({
		brandLight: style.brandLight,
		brandDark: style.brandDark,
		brandStrongLight: style.brandStrongLight,
		brandStrongDark: style.brandStrongDark,
		brandSoftLight: style.brandSoftLight,
		brandSoftDark: style.brandSoftDark,
		radiusPanel: style.radiusPanel,
		radiusControl: style.radiusControl
	}));

	let draft = $state<StyleValues>(initial);

	// เหมือน VS Code: แก้ช่องไหนแล้วบันทึกให้ทันทีเมื่อออกจากช่อง/เลือกสีเสร็จ
	const enhanceAll: SubmitFunction =
		() =>
		async ({ update }) => {
			await update({ invalidateAll: true });
		};

	let formEl = $state<HTMLFormElement | null>(null);

	function saveNow() {
		formEl?.requestSubmit();
	}
</script>

<details class="rounded-panel border border-line bg-sunken p-3">
	<summary class="cursor-pointer text-xs text-ink-secondary"
		>แก้ไขค่าทุกตัวของ “{style.name}”</summary
	>

	<form
		method="POST"
		action="?/update"
		use:enhance={enhanceAll}
		bind:this={formEl}
		onchange={saveNow}
		class="mt-3 flex flex-col gap-4"
	>
		<input type="hidden" name="id" value={style.id} />

		<label class="flex items-center gap-2 text-xs">
			<span class="w-16 shrink-0 text-ink-muted">ชื่อสไตล์</span>
			<input
				name="name"
				value={style.name}
				required
				maxlength="60"
				class="min-w-0 flex-1 rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge"
			/>
		</label>

		<StyleFields bind:values={draft} />

		<StylePreview values={draft} />

		<p class="text-xs text-ink-muted">
			สถานะ: {style.isActive
				? 'สไตล์นี้ถูกใช้อยู่ตอนนี้'
				: 'ยังไม่ถูกใช้ — กด “ใช้สไตล์นี้” ในรายการด้านบน'}
		</p>

		<button
			type="submit"
			class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
		>
			บันทึกการแก้ไข
		</button>
	</form>
</details>
