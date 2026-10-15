<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { untrack } from 'svelte';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';

	let { data, form } = $props();

	/** ฟอร์มสร้างถูกซ่อนไว้เป็นค่าเริ่มต้น — หน้าแรกของหน้านี้จึงเป็น "รายการ" ล้วน (ดู docs/ui-ux.md) */
	// untrack: อ่านค่าตั้งต้นครั้งเดียวโดยตั้งใจ (ไม่ต้องตามค่าใหม่)
	let creating = $state(untrack(() => data.projects.length === 0));

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div class="chat-column flex flex-col gap-4 py-6">
		<header class="flex flex-wrap items-center gap-3">
			<h1 class="text-lg font-semibold">โปรเจกต์</h1>
			<p class="text-xs text-ink-muted">{data.projects.length} โปรเจกต์</p>

			<button
				type="button"
				onclick={() => (creating = !creating)}
				aria-expanded={creating}
				class="ms-auto flex items-center gap-1.5 rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
			>
				<Plus size={14} strokeWidth={1.75} />
				{creating ? 'ปิดฟอร์ม' : 'สร้างโปรเจกต์'}
			</button>
		</header>

		{#if form?.message}
			<SettingsAlert message={form.message} />
		{/if}
		{#if form?.ok}
			<SettingsAlert kind="success" message={form.ok} />
		{/if}
		{#if data.listError}
			<SettingsAlert message={data.listError} />
		{/if}

		{#if creating}
			<section class="rounded-panel border border-line bg-surface p-4">
				<h2 class="text-sm font-semibold">โปรเจกต์ใหม่</h2>
				<p class="mt-1 text-xs text-ink-muted">
					โปรเจกต์ใช้จัดกลุ่มแชทและเก็บ “คำสั่งประจำโปรเจกต์” ไว้กับงานชิ้นนั้น
				</p>

				<form method="POST" action="?/create" class="mt-4 flex flex-col gap-3">
					<div class="grid gap-3 sm:grid-cols-2">
						<label class={labelClass}>
							ชื่อโปรเจกต์
							<input
								name="name"
								placeholder="งานวิจัย AI"
								required
								maxlength="60"
								class={inputClass}
							/>
						</label>

						<label class={labelClass}>
							ไอคอน (ชื่อไอคอน lucide เช่น folder, flask-conical)
							<input name="icon" placeholder="folder" maxlength="60" class={inputClass} />
						</label>
					</div>

					<label class={labelClass}>
						คำอธิบาย
						<input
							name="description"
							placeholder="รวบรวมงานวิจัยและสรุปบทความ"
							maxlength="300"
							class={inputClass}
						/>
					</label>

					<label class={labelClass}>
						คำสั่งประจำโปรเจกต์
						<textarea
							name="instructions"
							rows="4"
							maxlength="8000"
							placeholder="ตอบโดยอ้างงานวิจัยที่อยู่ในโปรเจกต์นี้ก่อนเสมอ"
							class="{inputClass} font-mono leading-relaxed"></textarea>
					</label>

					<button
						type="submit"
						class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
					>
						สร้างโปรเจกต์
					</button>
				</form>
			</section>
		{/if}

		{#if data.projects.length === 0}
			<p class="py-8 text-center text-sm text-ink-muted">
				ยังไม่มีโปรเจกต์ — เริ่มจากสร้างอันแรกด้านบน
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.projects as project (project.id)}
					{@const chatCount = data.chatCounts[project.id] ?? 0}
					<li
						class="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2 sm:flex-nowrap"
					>
						<Folder size={16} strokeWidth={1.75} class="shrink-0 text-ink-secondary" />
						<a href={`/project/${project.id}`} class="truncate text-sm font-medium hover:underline">
							{project.name}
						</a>

						{#if project.icon}
							<span
								class="shrink-0 rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
							>
								{project.icon}
							</span>
						{/if}

						<span class="flex shrink-0 items-center gap-1 text-[11px] text-ink-muted">
							<MessageSquare size={12} strokeWidth={1.75} />
							{chatCount}
						</span>

						<div class="ms-auto flex shrink-0 items-center gap-1">
							<a
								href={`/project/${project.id}`}
								aria-label="แก้ไขโปรเจกต์ {project.name}"
								title="แก้ไข"
								class="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
							>
								<Pencil size={14} strokeWidth={1.75} />
							</a>

							<form method="POST" action="?/delete">
								<input type="hidden" name="id" value={project.id} />
								<button
									type="submit"
									aria-label="ลบโปรเจกต์ {project.name}"
									title="ลบ"
									class="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
								>
									<Trash2 size={14} strokeWidth={1.75} />
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
