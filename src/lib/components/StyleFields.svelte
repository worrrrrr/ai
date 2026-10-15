<script lang="ts">
	import { mainColorsFromPrimary, parsePrimaryColor, primaryToHex } from '#lib/colorPalette.ts';
	import { isCssColor } from '#lib/settings.ts';
	import type { StyleValues } from '#lib/stylePresets.ts';

	let { values = $bindable() }: { values: StyleValues } = $props();

	// สีหลักที่ผู้ใช้กำลังเลือก — ตั้งต้นจากสีหลักโหมดสว่างที่บันทึกไว้
	let primary = $state(values.brandLight);
	let search = $state('');

	/** สีสำเร็จรูปให้เลือกเร็ว ๆ (ค้นหาได้ทั้งชื่อไทยและรหัสสี) */
	const presetColors: { name: string; hex: string }[] = [
		{ name: 'น้ำเงิน', hex: '#2563eb' },
		{ name: 'ฟ้า', hex: '#0ea5e9' },
		{ name: 'เขียวน้ำทะเล', hex: '#14b8a6' },
		{ name: 'มรกต', hex: '#10b981' },
		{ name: 'เขียวมะกอก', hex: '#65a30d' },
		{ name: 'อำพัน', hex: '#f59e0b' },
		{ name: 'ส้ม', hex: '#ea580c' },
		{ name: 'แดง', hex: '#dc2626' },
		{ name: 'ชมพู', hex: '#e11d48' },
		{ name: 'ม่วง', hex: '#7c3aed' },
		{ name: 'ม่วงแดง', hex: '#c026d3' },
		{ name: 'เทา', hex: '#6b7280' }
	];

	const query = $derived(search.trim().toLowerCase());
	const filteredColors = $derived(
		query === ''
			? presetColors
			: presetColors.filter((color) => color.name.includes(query) || color.hex.includes(query))
	);

	const primaryError = $derived(primary.trim() !== '' && parsePrimaryColor(primary) === null);
	const pickerValue = $derived(primaryToHex(primary) ?? '#2563eb');

	const chips = $derived([
		values.brandLight,
		values.brandStrongLight,
		values.brandSoftLight,
		values.brandDark,
		values.brandStrongDark,
		values.brandSoftDark
	]);

	type ColorKey =
		| 'brandLight'
		| 'brandDark'
		| 'brandStrongLight'
		| 'brandStrongDark'
		| 'brandSoftLight'
		| 'brandSoftDark';

	const colorFields: { key: ColorKey; label: string; name: string }[] = [
		{ key: 'brandLight', label: 'สว่าง · สีหลัก', name: 'brand_light' },
		{ key: 'brandStrongLight', label: 'สว่าง · สีเน้น', name: 'brand_strong_light' },
		{ key: 'brandSoftLight', label: 'สว่าง · พื้นอ่อน', name: 'brand_soft_light' },
		{ key: 'brandDark', label: 'มืด · สีหลัก', name: 'brand_dark' },
		{ key: 'brandStrongDark', label: 'มืด · สีเน้น', name: 'brand_strong_dark' },
		{ key: 'brandSoftDark', label: 'มืด · พื้นอ่อน', name: 'brand_soft_dark' }
	];

	const lengthFields: {
		key: 'radiusPanel' | 'radiusControl';
		label: string;
		name: string;
		placeholder: string;
	}[] = [
		{ key: 'radiusPanel', label: 'มุมการ์ด', name: 'radius_panel', placeholder: '0.75rem' },
		{ key: 'radiusControl', label: 'มุมคอนโทรล', name: 'radius_control', placeholder: '0.5rem' }
	];

	const inputClass =
		'min-w-0 flex-1 rounded-control border border-line bg-transparent px-2 py-1 font-mono text-xs focus:border-edge';

	/** เลือกสีหลัก -> คำนวณสีที่เหลือทั้ง 6 ตัว (มุมโค้งคงเดิม) */
	function applyPrimary(value: string) {
		primary = value;
		const next = mainColorsFromPrimary(value, {
			radiusPanel: values.radiusPanel,
			radiusControl: values.radiusControl
		});
		if (next) values = next;
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs text-ink-muted">สีหลัก</span>

		<!-- จานสีอิสระของเบราว์เซอร์ -->
		<input
			type="color"
			value={pickerValue}
			oninput={(event) => applyPrimary(event.currentTarget.value)}
			aria-label="เลือกสีหลักจากจานสี"
			class="h-7 w-9 shrink-0 cursor-pointer rounded-control border border-line bg-transparent p-0.5"
		/>

		<input
			value={primary}
			oninput={(event) => applyPrimary(event.currentTarget.value)}
			spellcheck="false"
			placeholder="#2563eb หรือ oklch(0.55 0.16 258)"
			aria-label="สีหลัก (hex หรือ oklch)"
			class={inputClass}
		/>

		{#if primaryError}
			<span class="text-xs text-warning">อ่านสีนี้ไม่ได้ — ใช้ “กำหนดเอง” ด้านล่าง</span>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<input
			bind:value={search}
			placeholder="ค้นหาชื่อ/รหัสสี…"
			aria-label="ค้นหาสีสำเร็จรูป"
			class="w-40 rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge"
		/>

		<ul class="flex flex-wrap items-center gap-1">
			{#each filteredColors as color (color.hex)}
				<li>
					<button
						type="button"
						onclick={() => applyPrimary(color.hex)}
						title={color.name}
						aria-label={color.name}
						class="h-6 w-6 rounded-control border border-line transition-transform hover:scale-110"
						style="background: {color.hex}"
					></button>
				</li>
			{/each}

			{#if filteredColors.length === 0}
				<li class="text-xs text-ink-muted">ไม่พบสีที่ค้นหา</li>
			{/if}
		</ul>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		{#each chips as color, index (index)}
			<span
				class="h-5 w-8 rounded-control border border-line"
				style="background: {isCssColor(color) ? color : 'transparent'}"
				title={color}
			></span>
		{/each}
		<span class="ms-2 text-xs text-ink-muted">สว่าง 3 / มืด 3 — คำนวณให้จากสีหลัก</span>
	</div>

	<details class="rounded-panel border border-line bg-sunken p-3">
		<summary class="cursor-pointer text-xs text-ink-secondary">
			กำหนดสีทีละค่า / มุมโค้ง (ขั้นสูง)
		</summary>

		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each colorFields as field (field.key)}
				<label class="flex items-center gap-2 text-xs">
					<span class="w-24 shrink-0 text-ink-muted">{field.label}</span>
					<input
						name={field.name}
						bind:value={values[field.key]}
						spellcheck="false"
						class={inputClass}
					/>
					<span
						class="h-5 w-5 shrink-0 rounded-control border border-line"
						style="background: {isCssColor(values[field.key]) ? values[field.key] : 'transparent'}"
					></span>
				</label>
			{/each}

			{#each lengthFields as field (field.key)}
				<label class="flex items-center gap-2 text-xs">
					<span class="w-24 shrink-0 text-ink-muted">{field.label}</span>
					<input
						name={field.name}
						bind:value={values[field.key]}
						placeholder={field.placeholder}
						spellcheck="false"
						class={inputClass}
					/>
				</label>
			{/each}
		</div>
	</details>
</div>
