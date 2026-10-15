<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';

	let { data, form } = $props();

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';

	function formatSize(size: number | null): string {
		if (!size) return 'ไม่ทราบขนาด';
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div class="chat-column flex flex-col gap-5 py-8">
		<a
			href="/project"
			class="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
		>
			<ArrowLeft size={14} strokeWidth={1.75} />
			โปรเจกต์ทั้งหมด
		</a>

		{#if form?.message}
			<SettingsAlert message={form.message} />
		{/if}
		{#if form?.ok}
			<SettingsAlert kind="success" message={form.ok} />
		{/if}

		<header class="flex flex-wrap items-center gap-2">
			<h1 class="text-lg font-semibold">{data.project.name}</h1>
			{#if data.project.icon}
				<span
					class="rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
				>
					{data.project.icon}
				</span>
			{/if}
		</header>

		{#if data.project.description}
			<p class="text-sm text-ink-secondary">{data.project.description}</p>
		{/if}

		<section class="rounded-panel border border-line bg-surface p-4">
			<h2 class="text-sm font-semibold">ตั้งค่าทุกช่อง</h2>

			<form method="POST" action="?/update" class="mt-3 flex flex-col gap-3">
				<div class="grid gap-3 sm:grid-cols-2">
					<label class={labelClass}>
						ชื่อโปรเจกต์
						<input name="name" value={data.project.name} required class={inputClass} />
					</label>

					<label class={labelClass}>
						ไอคอน
						<input name="icon" value={data.project.icon ?? ''} maxlength="60" class={inputClass} />
					</label>
				</div>

				<label class={labelClass}>
					คำอธิบาย
					<input
						name="description"
						value={data.project.description ?? ''}
						maxlength="300"
						class={inputClass}
					/>
				</label>

				<label class={labelClass}>
					คำสั่งประจำโปรเจกต์
					<textarea name="instructions" rows="6" class="{inputClass} font-mono leading-relaxed"
						>{data.project.instructions ?? ''}</textarea
					>
				</label>

				<button
					type="submit"
					class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
				>
					บันทึกการแก้ไข
				</button>
			</form>
		</section>

		<section class="rounded-panel border border-line bg-surface p-4">
			<h2 class="text-sm font-semibold">แชทในโปรเจกต์ ({data.chats.length})</h2>

			{#if data.chats.length === 0}
				<p class="mt-2 text-xs text-ink-muted">
					ยังไม่มีแชทในโปรเจกต์นี้ — แชทจะเข้ามาเมื่อมีการผูก project_id ให้แชท
				</p>
			{:else}
				<ul class="mt-2 flex flex-col gap-1">
					{#each data.chats as chat (chat.id)}
						<li>
							<a
								href={`/chat/${chat.id}`}
								class="flex items-center gap-2 rounded-control px-2 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
							>
								<MessageSquare size={14} strokeWidth={1.75} />
								<span class="truncate">{chat.title}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="rounded-panel border border-line bg-surface p-4">
			<h2 class="text-sm font-semibold">ไฟล์ในโปรเจกต์ ({data.files.length})</h2>

			{#if data.files.length === 0}
				<p class="mt-2 text-xs text-ink-muted">
					ยังไม่มีไฟล์ — ตาราง project_files พร้อมแล้ว (ยังไม่มีหน้าอัปโหลดในรอบนี้)
				</p>
			{:else}
				<ul class="mt-2 flex flex-col gap-1">
					{#each data.files as file (file.id)}
						<li>
							<a
								href={file.url}
								target="_blank"
								rel="noreferrer"
								class="flex items-center gap-2 rounded-control px-2 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
							>
								<FileText size={14} strokeWidth={1.75} />
								<span class="truncate">{file.name}</span>
								<span class="ms-auto shrink-0 text-ink-muted">{formatSize(file.size)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<form method="POST" action="?/delete" class="flex">
			<button
				type="submit"
				class="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
			>
				<Trash2 size={14} strokeWidth={1.75} />
				ลบโปรเจกต์นี้
			</button>
		</form>
	</div>
</main>
