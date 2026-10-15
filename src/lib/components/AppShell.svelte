<script lang="ts">
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ChatRow } from '#lib/server/chats.ts';
	import {
		settingsStyle,
		type AppUser,
		type StylePreset,
		type UserSettings
	} from '#lib/settings.ts';
	import Sidebar from './Sidebar.svelte';

	let {
		user,
		chats,
		settings,
		stylePreset,
		children
	}: {
		user: AppUser | null;
		chats: ChatRow[];
		settings: UserSettings;
		stylePreset?: StylePreset | null;
		children: Snippet;
	} = $props();

	// ค่าเริ่มต้นมาจาก settings ของผู้ใช้ (dynamic) การกดย่อ/ขยายมีผลเฉพาะรอบนี้
	// untrack บอก compiler ว่า "อ่านครั้งเดียวโดยตั้งใจ" ไม่ต้องตามค่าใหม่
	let collapsed = $state(untrack(() => settings.sidebarCollapsed));

	// แต่ถ้าผู้ใช้บันทึกค่าจากหน้า /settings/layout ให้ค่าที่บันทึกชนะการกดชั่วคราว
	let lastSaved = untrack(() => settings.sidebarCollapsed);
	$effect(() => {
		if (settings.sidebarCollapsed !== lastSaved) {
			lastSaved = settings.sidebarCollapsed;
			collapsed = settings.sidebarCollapsed;
		}
	});

	/** วิธีย่อที่ผู้ใช้เลือก — none = ย่อไม่ได้, icon = ย่อเหลือไอคอน, offcanvas = ซ่อนทั้งหมด */
	const collapsible = $derived(settings.sidebarCollapsible);
	/** ซ่อนแถบด้านข้างทั้งหมด (offcanvas) */
	const offcanvas = $derived(collapsed && collapsible === 'offcanvas');
	/** ย่อเหลือไอคอน — ยังแสดงแถบอยู่ แต่แคบและซ่อนข้อความ */
	const rail = $derived(collapsed && collapsible === 'icon');

	// ลอย/อินเซ็ต เป็นเรื่องของเปลือก (ดู utility ใน layout.css)
	const shellClass = $derived(
		[
			'app-shell h-dvh',
			settings.sidebarVariant === 'floating' ? 'shell-floating' : '',
			settings.sidebarVariant === 'inset' ? 'shell-inset' : '',
			rail ? 'shell-sidebar-rail' : ''
		]
			.filter(Boolean)
			.join(' ')
	);

	// ค่าความกว้างถูกส่งมาเป็น inline style จึงต้องเขียน --sidebar-width ทับอีกครั้งเมื่ออยู่ในโหมดไอคอน
	const shellStyle = $derived(
		[
			settingsStyle(settings, offcanvas, stylePreset),
			rail ? '--sidebar-width: var(--sidebar-rail-width)' : ''
		]
			.filter(Boolean)
			.join('; ')
	);

	// คีย์ลัดแบบ VS Code: Ctrl/⌘+B ย่อ/ขยาย (ข้ามถ้าผู้ใช้ตั้งว่า "ย่อไม่ได้")
	$effect(() => {
		const onKeydown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'b') return;
			event.preventDefault();
			if (collapsible === 'none') return;
			collapsed = !collapsed;
		};

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

<div class={shellClass} style={shellStyle}>
	{#if !offcanvas}
		<Sidebar
			{user}
			{chats}
			order={settings.sidebarSide === 'right' ? 2 : 1}
			canCollapse={collapsible !== 'none'}
			onCollapse={() => (collapsed = true)}
		/>
	{/if}

	<div
		class="flex min-w-0 flex-1 flex-col overflow-hidden"
		class:shell-content-full={offcanvas}
		style="order: {settings.sidebarSide === 'right' ? 1 : 2}"
	>
		{#if offcanvas}
			<div class="px-2 py-2">
				<button
					type="button"
					class="rounded-control border border-line p-1.5 text-ink-secondary transition-colors hover:bg-hover"
					aria-label="ขยายแถบด้านข้าง"
					title="ขยายแถบด้านข้าง (Ctrl+B)"
					onclick={() => (collapsed = false)}
				>
					<!-- ไอคอนชี้ทางเดียวกับด้านที่แถบจะโผล่ (ซ้าย/ขวา) — เดิมใช้ไอคอนแบรนด์ซึ่งไม่บอกความหมาย -->
					{#if settings.sidebarSide === 'right'}
						<PanelRightOpen size={18} strokeWidth={1.75} />
					{:else}
						<PanelLeftOpen size={18} strokeWidth={1.75} />
					{/if}
				</button>
			</div>
		{/if}

		{@render children()}
	</div>
</div>
