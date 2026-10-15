<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import Folder from '@lucide/svelte/icons/folder';
	import House from '@lucide/svelte/icons/house';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { page } from '$app/state';
	import type { ChatRow } from '#lib/server/chats.ts';
	import type { AppUser } from '#lib/settings.ts';

	let {
		user,
		chats,
		order = 1,
		canCollapse = true,
		onCollapse
	}: {
		user: AppUser | null;
		chats: ChatRow[];
		/** ลำดับใน grid ของเปลือกแอป — 2 = อยู่ขวา (ผู้ใช้เลือกได้ที่ /settings/layout) */
		order?: number;
		/** false = ผู้ใช้ตั้ง "ย่อไม่ได้" จึงไม่ต้องมีปุ่มย่อ */
		canCollapse?: boolean;
		onCollapse: () => void;
	} = $props();

	/** เมนูหลัก — exact = ต้องตรงเป๊ะ (หน้าแรก) ที่เหลือถือว่าเปิดอยู่เมื่ออยู่ใต้ path นั้น */
	const navLinks = [
		{ href: '/', label: 'หน้าแรก', icon: House, exact: true },
		{ href: '/chat', label: 'แชท', icon: MessageSquare, exact: false },
		{ href: '/agent', label: 'เอเจนต์', icon: Bot, exact: false },
		{ href: '/project', label: 'โปรเจกต์', icon: Folder, exact: false }
	];

	function isActive(link: { href: string; exact: boolean }): boolean {
		const path = page.url.pathname;
		if (link.exact) return path === link.href;
		return path === link.href || path.startsWith(`${link.href}/`);
	}

	const settingsLinks = [
		{ href: '/settings/providers', label: 'ผู้ให้บริการ' },
		{ href: '/settings/prompts', label: 'พรอมป์' },
		{ href: '/settings/styles', label: 'สไตล์' },
		{ href: '/settings/layout', label: 'เลย์เอาต์' }
	];
</script>

<aside class="flex h-dvh min-h-0 flex-col border-e border-line bg-surface" style="order: {order}">
	<header class="flex items-center gap-1 px-2 py-2.5">
		<!-- brand icon ทำหน้าที่ panelLeft: กดแล้วย่อ/ขยายแถบด้านข้าง -->
		{#if canCollapse}
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-control px-1.5 py-1 text-sm font-semibold text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
				aria-label="ย่อแถบด้านข้าง"
				onclick={onCollapse}
			>
				<Sparkles size={18} strokeWidth={1.75} />
				<span class="rail-hide">ai</span>
			</button>
		{:else}
			<div class="flex items-center gap-1.5 px-1.5 py-1 text-sm font-semibold text-ink-secondary">
				<Sparkles size={18} strokeWidth={1.75} />
				<span class="rail-hide">ai</span>
			</div>
		{/if}

		<a
			href="/"
			class="ms-auto rounded-control p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
			aria-label="เริ่มแชทใหม่"
		>
			<Plus size={18} strokeWidth={2} />
		</a>
	</header>

	<nav class="px-2 pb-2" aria-label="เมนูหลัก">
		<ul class="flex flex-col gap-0.5">
			{#each navLinks as link (link.href)}
				{@const Icon = link.icon}
				{@const active = isActive(link)}
				<li>
					<a
						href={link.href}
						aria-current={active ? 'page' : undefined}
						aria-label={link.label}
						title={link.label}
						class="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm transition-colors hover:bg-hover"
						class:bg-hover={active}
						class:font-medium={active}
						class:text-ink={active}
						class:text-ink-secondary={!active}
					>
						<Icon size={16} strokeWidth={1.75} />
						<span class="rail-hide">{link.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<nav
		class="rail-hide scroll-slim min-h-0 flex-1 overflow-y-auto border-t border-line px-2 pt-2 pb-2"
		aria-label="รายการแชท"
	>
		{#if chats.length === 0}
			<p class="px-2 py-3 text-sm text-ink-muted">ยังไม่มีแชท</p>
		{:else}
			<ul class="flex flex-col gap-0.5">
				{#each chats as chat (chat.id)}
					{@const active = page.params.id === chat.id}
					<li>
						<a
							href={`/chat/${chat.id}`}
							aria-current={active ? 'page' : undefined}
							class="block truncate rounded-control px-2 py-1.5 text-sm transition-colors hover:bg-hover"
							class:bg-hover={active}
							class:font-medium={active}
							class:text-ink={active}
							class:text-ink-secondary={!active}
						>
							{chat.title}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<footer class="rail-hide border-t border-line px-3 py-3 text-xs">
		{#if user}
			<p class="truncate text-ink-secondary">{user.email ?? 'ผู้ใช้'}</p>
			<nav class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
				{#each settingsLinks as link (link.href)}
					<a class="text-ink-muted transition-colors hover:text-ink" href={link.href}
						>{link.label}</a
					>
				{/each}
			</nav>
		{:else}
			<a class="text-brand underline" href="/auth">เข้าสู่ระบบ</a>
		{/if}
	</footer>
</aside>
