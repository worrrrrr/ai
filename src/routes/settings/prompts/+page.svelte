<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';

	let { data, form } = $props();

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';

	/** ฟอร์มสร้างพรอมป์ถูกซ่อนไว้เป็นค่าเริ่มต้น — หน้าเปิดมาจึงเป็น "รายการ" ล้วน */
	let adding = $state(false);
</script>

{#if form?.message}
	<SettingsAlert message={form.message} />
{/if}
{#if form?.ok}
	<SettingsAlert kind="success" message={form.ok} />
{/if}
{#if data.listError}
	<SettingsAlert message={data.listError} />
{/if}

<!-- ปุ่มหลักอยู่ในจอแรก · ฟอร์มยาวอยู่หลังปุ่ม เพื่อให้หน้าเปิดมาเป็นรายการล้วน -->
<div class="flex justify-end">
	<button
		type="button"
		onclick={() => (adding = !adding)}
		aria-expanded={adding}
		class="rounded-control border border-line px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
	>
		{adding ? 'ปิดฟอร์ม' : 'สร้างพรอมป์'}
	</button>
</div>

{#if adding}
	<SettingsPanel
		title="สร้างพรอมป์"
		description="พรอมป์ระบบ (system prompt) ที่จะส่งให้โมเดล — บันทึกแล้วจะกลายเป็นพรอมป์ที่ใช้อยู่ทันที"
	>
		<form method="POST" action="?/create" class="flex flex-col gap-3">
			<label class={labelClass}>
				ชื่อพรอมป์
				<input
					name="title"
					placeholder="เช่น ผู้ช่วยภาษาไทย กระชับ"
					required
					maxlength="80"
					class={inputClass}
				/>
			</label>

			<label class={labelClass}>
				พรอมป์
				<textarea
					name="body"
					rows="6"
					required
					maxlength="8000"
					placeholder="You are a helpful assistant. ตอบเป็นภาษาไทย กระชับ ตรงประเด็น"
					class="{inputClass} font-mono leading-relaxed"></textarea>
			</label>

			<button
				type="submit"
				class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
			>
				บันทึกพรอมป์
			</button>
		</form>
	</SettingsPanel>
{/if}

<SettingsPanel
	title="พรอมป์ของฉัน"
	description="พรอมป์ที่บันทึกไว้ในบัญชีนี้ — ใช้ได้ทีละอัน (อันที่ทำเครื่องหมายว่า “ใช้อยู่”)"
>
	{#if data.prompts.length === 0}
		<p class="text-sm text-ink-muted">ยังไม่มีพรอมป์ที่บันทึกไว้</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each data.prompts as prompt (prompt.id)}
				{@const active = data.choices.promptId === prompt.id}
				<li
					class="flex flex-col gap-3 rounded-panel border p-3"
					class:border-brand={active}
					class:border-line={!active}
				>
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-sm font-medium">{prompt.title}</p>
						{#if active}
							<span class="rounded-control bg-brand-soft px-1.5 py-0.5 text-[11px] text-ink"
								>ใช้อยู่</span
							>
						{/if}

						<div class="ms-auto flex flex-wrap items-center gap-2">
							{#if !active}
								<form method="POST" action="?/use">
									<input type="hidden" name="id" value={prompt.id} />
									<button
										type="submit"
										class="rounded-control border border-line px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:bg-hover"
									>
										ใช้พรอมป์นี้
									</button>
								</form>
							{/if}

							<form method="POST" action="?/delete">
								<input type="hidden" name="id" value={prompt.id} />
								<button
									type="submit"
									class="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
									aria-label="ลบพรอมป์ {prompt.title}"
								>
									<Trash2 size={14} strokeWidth={1.75} />
									ลบ
								</button>
							</form>
						</div>
					</div>

					<details class="rounded-panel border border-line bg-sunken p-3">
						<summary class="cursor-pointer text-xs text-ink-secondary"
							>ดู/แก้ไขข้อความพรอมป์</summary
						>

						<form method="POST" action="?/update" class="mt-3 flex flex-col gap-3">
							<input type="hidden" name="id" value={prompt.id} />

							<label class={labelClass}>
								ชื่อพรอมป์
								<input
									name="title"
									value={prompt.title}
									required
									maxlength="80"
									class={inputClass}
								/>
							</label>

							<label class={labelClass}>
								พรอมป์
								<textarea
									name="body"
									rows="6"
									required
									maxlength="8000"
									class="{inputClass} font-mono leading-relaxed">{prompt.body}</textarea
								>
							</label>

							<button
								type="submit"
								class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
							>
								บันทึกการแก้ไข
							</button>
						</form>
					</details>
				</li>
			{/each}
		</ul>
	{/if}
</SettingsPanel>
