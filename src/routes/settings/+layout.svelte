<script lang="ts">
	import MessageSquareQuote from '@lucide/svelte/icons/message-square-quote';
	import Palette from '@lucide/svelte/icons/palette';
	import Server from '@lucide/svelte/icons/server';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	const tabs = [
		{ href: '/settings/providers', label: 'ผู้ให้บริการ', icon: Server },
		{ href: '/settings/prompts', label: 'พรอมป์', icon: MessageSquareQuote },
		{ href: '/settings/styles', label: 'สไตล์', icon: Palette },
		{ href: '/settings/layout', label: 'เลย์เอาต์', icon: SlidersHorizontal }
	];
</script>

<main class="flex min-h-0 flex-1 flex-col overflow-hidden">
	<!-- หัวเรื่อง + แท็บอยู่ "นอก" กรอบที่เลื่อน: หายไปจากจอไม่ได้ (ดู docs/ui-ux.md §1) -->
	<div class="shrink-0 px-4 pt-6 lg:px-6">
		<header>
			<h1 class="text-lg font-semibold">ตั้งค่า</h1>
			<p class="mt-1 text-xs text-ink-muted">
				ทุกค่าในหน้านี้ปรับได้เองทั้งหมด — กดใช้แม่แบบเป็นจุดเริ่ม แล้วแก้ต่อได้ตามใจ
			</p>
		</header>

		{#if data.profileError}
			<div class="mt-3">
				<SettingsAlert message={data.profileError} />
			</div>
		{/if}

		<nav aria-label="หมวดตั้งค่า" class="mt-4 flex flex-wrap gap-1 border-b border-line">
			{#each tabs as tab (tab.href)}
				{@const Icon = tab.icon}
				{@const active = page.url.pathname === tab.href}
				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class="-mb-px flex items-center gap-1.5 rounded-t-control border-b-2 px-3 py-2 text-sm transition-colors"
					class:border-brand={active}
					class:border-transparent={!active}
					class:font-medium={active}
					class:text-ink={active}
					class:hover:bg-hover={!active}
					class:text-ink-secondary={!active}
				>
					<Icon size={15} strokeWidth={1.75} />
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>

	<!-- เลื่อนเฉพาะกรอบนี้ — แท็บไม่เลื่อนตาม (ต้องมี overflow-y-auto ไม่งั้นเนื้อหาล้นแล้วเลื่อนไม่ได้) -->
	<div class="flex scroll-slim min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-6">
		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
	</div>
</main>
