<script lang="ts">
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import Plus from '@lucide/svelte/icons/plus';
	import { page } from '$app/state';
	import type { ChatRow } from '#lib/server/chats.ts';
	import type { AppUser } from '#lib/settings.ts';

	let {
		user,
		chats,
		onCollapse
	}: {
		user: AppUser | null;
		chats: ChatRow[];
		onCollapse: () => void;
	} = $props();

	const settingsLinks = [
		{ href: '/settings/providers', label: 'ผู้ให้บริการ' },
		{ href: '/settings/prompts', label: 'พรอมป์' },
		{ href: '/settings/styles', label: 'สไตล์' },
		{ href: '/settings/layout', label: 'เลย์เอาต์' }
	];
</script>

<aside class="flex h-dvh min-h-0 flex-col border-e border-line bg-surface">
	<header class="flex items-center gap-1 px-2 py-2.5">
		<a href="/chat" class="rounded-control px-1.5 py-1 text-sm font-semibold hover:bg-hover">
			แชทของฉัน
		</a>

		<button
			type="button"
			class="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
			aria-label="ย่อแถบด้านข้าง"
			onclick={onCollapse}
		>
			<PanelLeftClose size={18} strokeWidth={1.75} />
		</button>

		<form method="POST" action="/chat?/new" class="ms-auto">
			<button
				type="submit"
				class="rounded-control p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
				aria-label="เริ่มแชทใหม่"
			>
				<Plus size={18} strokeWidth={2} />
			</button>
		</form>
	</header>

	<nav class="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="รายการแชท">
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

	<footer class="border-t border-line px-3 py-3 text-xs">
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
