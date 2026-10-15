<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';

	let { data, form } = $props();

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div class="chat-column flex flex-col gap-5 py-8">
		<a
			href="/agent"
			class="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
		>
			<ArrowLeft size={14} strokeWidth={1.75} />
			เอเจนต์ทั้งหมด
		</a>

		{#if form?.message}
			<SettingsAlert message={form.message} />
		{/if}
		{#if form?.ok}
			<SettingsAlert kind="success" message={form.ok} />
		{/if}

		<header class="flex flex-wrap items-center gap-2">
			<h1 class="text-lg font-semibold">{data.agent.name}</h1>
			<span
				class="rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
			>
				{data.agent.model}
			</span>
			<a
				href={`/?agent=${data.agent.id}`}
				class="ms-auto rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
			>
				เริ่มแชทด้วยเอเจนต์นี้
			</a>
		</header>

		{#if data.agent.description}
			<p class="text-sm text-ink-secondary">{data.agent.description}</p>
		{/if}

		<section class="rounded-panel border border-line bg-surface p-4">
			<h2 class="text-sm font-semibold">ตั้งค่าทุกช่อง</h2>

			<form method="POST" action="?/update" class="mt-3 flex flex-col gap-3">
				<div class="grid gap-3 sm:grid-cols-2">
					<label class={labelClass}>
						ชื่อเอเจนต์
						<input name="name" value={data.agent.name} required class={inputClass} />
					</label>

					<label class={labelClass}>
						โมเดล
						<input name="model" value={data.agent.model} required class={inputClass} />
					</label>

					<label class={labelClass}>
						ผู้ให้บริการ
						<select name="provider_id" class={inputClass}>
							<option value="" selected={!data.agent.provider_id}>ตามค่าเริ่มต้นของระบบ</option>
							{#each data.providers as provider (provider.id)}
								<option value={provider.id} selected={provider.id === data.agent.provider_id}>
									{provider.label ?? provider.id}
								</option>
							{/each}
						</select>
					</label>

					<label class={labelClass}>
						อุณหภูมิ
						<input
							type="number"
							name="temperature"
							value={data.agent.temperature ?? 0.7}
							step="0.1"
							min="0"
							max="2"
							class={inputClass}
						/>
					</label>
				</div>

				<label class={labelClass}>
					คำอธิบาย
					<input
						name="description"
						value={data.agent.description ?? ''}
						maxlength="300"
						class={inputClass}
					/>
				</label>

				<label class={labelClass}>
					พรอมป์ระบบ
					<textarea name="system_prompt" rows="6" class="{inputClass} font-mono leading-relaxed"
						>{data.agent.system_prompt ?? ''}</textarea
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
			<h2 class="text-sm font-semibold">แชทที่ใช้เอเจนต์นี้ ({data.chats.length})</h2>

			{#if data.chats.length === 0}
				<p class="mt-2 text-xs text-ink-muted">ยังไม่มีแชทที่ผูกกับเอเจนต์นี้</p>
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

		<form method="POST" action="?/delete" class="flex">
			<button
				type="submit"
				class="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
			>
				<Trash2 size={14} strokeWidth={1.75} />
				ลบเอเจนต์นี้
			</button>
		</form>
	</div>
</main>
