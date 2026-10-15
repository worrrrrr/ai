<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { untrack } from 'svelte';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';

	let { data, form } = $props();

	/** ฟอร์มสร้างถูกซ่อนไว้เป็นค่าเริ่มต้น — หน้าแรกของหน้านี้จึงเป็น "รายการ" ล้วน (ดู docs/ui-ux.md) */
	// untrack: อ่านค่าตั้งต้นครั้งเดียวโดยตั้งใจ (ไม่ต้องตามค่าใหม่)
	let creating = $state(untrack(() => data.agents.length === 0));

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';

	function providerLabel(providerId: string | null): string {
		if (!providerId) return 'ค่าเริ่มต้นของระบบ';
		return (
			data.providers.find((provider) => provider.id === providerId)?.label ?? 'ไม่พบผู้ให้บริการ'
		);
	}
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div class="chat-column flex flex-col gap-4 py-6">
		<header class="flex flex-wrap items-center gap-3">
			<h1 class="text-lg font-semibold">เอเจนต์</h1>
			<p class="text-xs text-ink-muted">{data.agents.length} ตัว</p>

			<button
				type="button"
				onclick={() => (creating = !creating)}
				aria-expanded={creating}
				class="ms-auto flex items-center gap-1.5 rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
			>
				<Plus size={14} strokeWidth={1.75} />
				{creating ? 'ปิดฟอร์ม' : 'สร้างเอเจนต์'}
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
				<h2 class="text-sm font-semibold">เอเจนต์ใหม่</h2>
				<p class="mt-1 text-xs text-ink-muted">
					ผูกโมเดล + พรอมป์ระบบ + อุณหภูมิไว้ด้วยกัน แล้วเลือกใช้ตอนเริ่มแชทหรือตอนเรียกทีม
				</p>

				<form method="POST" action="?/create" class="mt-4 flex flex-col gap-3">
					<div class="grid gap-3 sm:grid-cols-2">
						<label class={labelClass}>
							ชื่อเอเจนต์
							<input
								name="name"
								placeholder="ผู้ช่วยวิจัย"
								required
								maxlength="60"
								class={inputClass}
							/>
						</label>

						<label class={labelClass}>
							โมเดล
							<input name="model" placeholder="gpt-oss:120b-cloud" required class={inputClass} />
						</label>

						<label class={labelClass}>
							ผู้ให้บริการ
							<select name="provider_id" class={inputClass}>
								<option value="">ค่าเริ่มต้นของระบบ</option>
								{#each data.providers as provider (provider.id)}
									<option value={provider.id}>{provider.label ?? provider.id}</option>
								{/each}
							</select>
						</label>

						<label class={labelClass}>
							อุณหภูมิ (0 = นิ่ง, 1 = สร้างสรรค์)
							<input
								type="number"
								name="temperature"
								value="0.7"
								step="0.1"
								min="0"
								max="2"
								class={inputClass}
							/>
						</label>
					</div>

					<label class={labelClass}>
						คำอธิบาย (ไว้ช่วยจำว่าตัวนี้ทำอะไร)
						<input
							name="description"
							placeholder="ตอบคำถามงานวิจัย อ้างแหล่งเสมอ"
							maxlength="300"
							class={inputClass}
						/>
					</label>

					<label class={labelClass}>
						พรอมป์ระบบ
						<textarea
							name="system_prompt"
							rows="4"
							maxlength="8000"
							placeholder="You are a research assistant. ตอบเป็นภาษาไทย อ้างแหล่งที่มาเสมอ"
							class="{inputClass} font-mono leading-relaxed"></textarea>
					</label>

					<button
						type="submit"
						class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
					>
						สร้างเอเจนต์
					</button>
				</form>
			</section>
		{/if}

		{#if data.agents.length === 0}
			<p class="py-8 text-center text-sm text-ink-muted">
				ยังไม่มีเอเจนต์ — เริ่มจากสร้างตัวแรกด้านบน
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.agents as agent (agent.id)}
					<li
						class="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2 sm:flex-nowrap"
					>
						<Bot size={16} strokeWidth={1.75} class="shrink-0 text-ink-secondary" />
						<a href={`/agent/${agent.id}`} class="truncate text-sm font-medium hover:underline">
							{agent.name}
						</a>
						<span
							class="shrink-0 rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
						>
							{agent.model}
						</span>
						<span class="hidden truncate text-[11px] text-ink-muted sm:inline">
							{providerLabel(agent.provider_id)}
						</span>

						<div class="ms-auto flex shrink-0 items-center gap-1">
							<a
								href={`/agent/${agent.id}`}
								aria-label="แก้ไขเอเจนต์ {agent.name}"
								title="แก้ไข"
								class="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
							>
								<Pencil size={14} strokeWidth={1.75} />
							</a>

							<a
								href={`/?agent=${agent.id}`}
								title="เริ่มแชทด้วยเอเจนต์นี้"
								class="flex items-center gap-1.5 rounded-control bg-brand-soft px-2.5 py-1 text-xs text-ink transition-colors hover:bg-hover"
							>
								<MessageSquare size={14} strokeWidth={1.75} />
								เริ่มแชท
							</a>

							<form method="POST" action="?/delete">
								<input type="hidden" name="id" value={agent.id} />
								<button
									type="submit"
									aria-label="ลบเอเจนต์ {agent.name}"
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
