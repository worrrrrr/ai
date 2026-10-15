<script lang="ts">
	let { data, form } = $props();
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div class="chat-column flex flex-col gap-6 py-8">
		<header class="flex items-center justify-between gap-3">
			<h1 class="text-lg font-semibold">แชทของฉัน</h1>

			<a
				href="/"
				class="rounded-control border border-line px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
			>
				เริ่มแชทใหม่
			</a>
		</header>

		{#if form?.message}
			<p
				role="alert"
				class="rounded-control border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
			>
				{form.message}
			</p>
		{/if}

		{#if data.chats.length === 0}
			<p class="py-10 text-center text-sm text-ink-muted">ยังไม่มีแชท</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.chats as chat (chat.id)}
					<li
						class="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2"
					>
						<a
							href={`/chat/${chat.id}`}
							class="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
						>
							{chat.title}
						</a>

						<form method="POST" action="?/rename" class="flex items-center gap-1">
							<input type="hidden" name="id" value={chat.id} />
							<input
								name="title"
								value={chat.title}
								aria-label="ชื่อแชท"
								class="w-40 rounded-control border border-line bg-transparent px-2 py-1 text-sm focus:border-edge"
							/>
							<button
								type="submit"
								class="rounded-control px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-hover hover:text-ink"
							>
								เปลี่ยนชื่อ
							</button>
						</form>

						<form method="POST" action="?/delete">
							<input type="hidden" name="id" value={chat.id} />
							<button
								type="submit"
								class="rounded-control px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
							>
								ลบ
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
