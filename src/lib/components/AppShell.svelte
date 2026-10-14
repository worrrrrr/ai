<script lang="ts">
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ChatRow } from '#lib/server/chats.ts';
	import { settingsStyle, type AppUser, type UserSettings } from '#lib/settings.ts';
	import Sidebar from './Sidebar.svelte';

	let {
		user,
		chats,
		settings,
		children
	}: {
		user: AppUser | null;
		chats: ChatRow[];
		settings: UserSettings;
		children: Snippet;
	} = $props();

	// ค่าเริ่มต้นมาจาก settings ของผู้ใช้ (dynamic) การกดย่อ/ขยายมีผลเฉพาะรอบนี้
	// untrack บอก compiler ว่า "อ่านครั้งเดียวโดยตั้งใจ" ไม่ต้องตามค่าใหม่
	let collapsed = $state(untrack(() => settings.sidebarCollapsed));
</script>

<div class="app-shell h-dvh" style={settingsStyle(settings, collapsed)}>
	{#if !collapsed}
		<Sidebar {user} {chats} onCollapse={() => (collapsed = true)} />
	{/if}

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if collapsed}
			<div class="px-2 py-2">
				<button
					type="button"
					class="rounded-control border border-line p-1.5 text-ink-secondary transition-colors hover:bg-hover"
					aria-label="ขยายแถบด้านข้าง"
					onclick={() => (collapsed = false)}
				>
					<PanelLeft size={18} strokeWidth={1.75} />
				</button>
			</div>
		{/if}

		{@render children()}
	</div>
</div>
