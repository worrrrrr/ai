<script lang="ts">
	import PlugZap from '@lucide/svelte/icons/plug-zap';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SettingsAlert from '#lib/components/SettingsAlert.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';

	let { data, form } = $props();

	const inputClass =
		'w-full rounded-control border border-line bg-transparent px-2 py-1 text-xs focus:border-edge';
	const labelClass = 'flex flex-col gap-1 text-xs text-ink-muted';

	/** ฟอร์มเพิ่มถูกซ่อนไว้เป็นค่าเริ่มต้น — หน้าเปิดมาจึงเป็น "รายการ" ล้วน (ดู docs/ui-ux.md) */
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
{#if !data.canSeal}
	<SettingsAlert
		kind="info"
		message="ยังไม่ได้ตั้ง PROVIDER_KEY_SECRET — การเก็บกุญแจและการทดสอบที่ต้องใช้กุญแจจะทำไม่ได้ (ใส่ใน .env ตอน dev)"
	/>
{/if}

{#if form?.models}
	<SettingsPanel
		title={`ผลทดสอบการเชื่อมต่อ: ${form.tested}`}
		description={`แหล่งข้อมูล: ${form.source} · โปรโตคอลที่ใช้: ${form.protocol} — บันทึกรายชื่อโมเดลลงแถวนี้แล้ว`}
	>
		<ul class="flex flex-wrap gap-1.5">
			{#each form.models as model (model)}
				<li
					class="rounded-control border border-line bg-sunken px-2 py-1 font-mono text-xs text-ink-secondary"
				>
					{model}
				</li>
			{/each}
		</ul>
	</SettingsPanel>
{/if}

<!-- ปุ่มหลักอยู่ในจอแรก · ฟอร์มยาวอยู่หลังปุ่ม เพื่อให้หน้าเปิดมาเป็นรายการล้วน -->
<div class="flex justify-end">
	<button
		type="button"
		onclick={() => (adding = !adding)}
		aria-expanded={adding}
		class="rounded-control border border-line px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
	>
		{adding ? 'ปิดฟอร์ม' : 'เพิ่มผู้ให้บริการ'}
	</button>
</div>

{#if adding}
	<SettingsPanel
		title="เพิ่มผู้ให้บริการ"
		description="ตารางจริงเก็บ label/base_url/models และกุญแจแบบเข้ารหัส (key_sealed) — ไม่เก็บกุญแจเป็นข้อความธรรมดา"
	>
		<form method="POST" action="?/create" class="flex flex-col gap-3" autocomplete="off">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class={labelClass}>
					ชื่อที่แสดง (มีคำว่า ollama = ใช้โปรโตคอล Ollama)
					<input
						name="label"
						placeholder="ollama ในเครื่อง"
						required
						maxlength="60"
						class={inputClass}
					/>
				</label>

				<label class={labelClass}>
					ที่อยู่ (base URL)
					<input
						name="base_url"
						placeholder="http://127.0.0.1:11434"
						spellcheck="false"
						class={inputClass}
					/>
				</label>
			</div>

			<label class={labelClass}>
				รายชื่อโมเดล (บรรทัดละหนึ่งตัว — กด “ทดสอบเชื่อมต่อ” แล้วระบบจะเติมให้)
				<textarea
					name="models"
					rows="3"
					placeholder="gpt-oss:120b-cloud"
					class="{inputClass} font-mono"></textarea>
			</label>

			<label class={labelClass}>
				กุญแจ (ไม่บังคับ — จะถูกเข้ารหัสก่อนเก็บ และแสดงแค่ 4 ตัวท้าย)
				<input
					type="password"
					name="api_key"
					autocomplete="new-password"
					placeholder="วางกุญแจของผู้ให้บริการ"
					class={inputClass}
				/>
			</label>

			<button
				type="submit"
				class="self-start rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
			>
				บันทึกผู้ให้บริการ
			</button>
		</form>
	</SettingsPanel>
{/if}

<SettingsPanel
	title="ผู้ให้บริการของฉัน"
	description="บันทึกก่อนแล้วกด “ทดสอบเชื่อมต่อ” — ระบบอ่านค่าจากฐานข้อมูลและยิงถามรายชื่อโมเดลจริง"
>
	{#if data.providers.length === 0}
		<p class="text-sm text-ink-muted">ยังไม่มีผู้ให้บริการที่บันทึกไว้</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each data.providers as provider (provider.id)}
				{@const active = data.choices.providerId === provider.id}
				<li
					class="flex flex-col gap-3 rounded-panel border p-3"
					class:border-brand={active}
					class:border-line={!active}
				>
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-sm font-medium">{provider.label ?? 'ไม่มีชื่อ'}</p>
						<span
							class="rounded-control border border-line px-1.5 py-0.5 text-[11px] text-ink-muted"
						>
							{provider.protocol === 'ollama' ? 'Ollama' : 'OpenAI-compatible'}
						</span>
						{#if active}
							<span class="rounded-control bg-brand-soft px-1.5 py-0.5 text-[11px] text-ink"
								>ใช้อยู่</span
							>
						{/if}
					</div>

					<dl class="grid gap-1 text-xs sm:grid-cols-2">
						<div class="flex gap-2">
							<dt class="text-ink-muted">ที่อยู่</dt>
							<dd class="truncate font-mono text-ink-secondary">{provider.base_url ?? '—'}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="text-ink-muted">กุญแจ</dt>
							<dd class="text-ink-secondary">{provider.key_hint ?? 'ยังไม่ได้เก็บ'}</dd>
						</div>
					</dl>

					{#if provider.models.length > 0}
						<ul class="flex flex-wrap gap-1.5">
							{#each provider.models as model (model)}
								<li
									class="rounded-control border border-line bg-sunken px-2 py-1 font-mono text-xs text-ink-secondary"
								>
									{model}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-xs text-ink-muted">ยังไม่มีรายชื่อโมเดล — กดทดสอบเชื่อมต่อ</p>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						<form method="POST" action="?/test">
							<input type="hidden" name="id" value={provider.id} />
							<button
								type="submit"
								class="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:bg-hover"
							>
								<PlugZap size={14} strokeWidth={1.75} />
								ทดสอบเชื่อมต่อ
							</button>
						</form>

						{#if !active}
							<form method="POST" action="?/use">
								<input type="hidden" name="id" value={provider.id} />
								<button
									type="submit"
									class="rounded-control border border-line px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:bg-hover"
								>
									ใช้ตัวนี้
								</button>
							</form>
						{/if}

						{#if provider.key_sealed}
							<form method="POST" action="?/clear_key">
								<input type="hidden" name="id" value={provider.id} />
								<button
									type="submit"
									class="rounded-control border border-line px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:bg-hover"
								>
									ลบกุญแจ
								</button>
							</form>
						{/if}

						<form method="POST" action="?/delete" class="ms-auto">
							<input type="hidden" name="id" value={provider.id} />
							<button
								type="submit"
								class="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
								aria-label="ลบผู้ให้บริการ {provider.label ?? ''}"
							>
								<Trash2 size={14} strokeWidth={1.75} />
								ลบ
							</button>
						</form>
					</div>

					<details class="rounded-panel border border-line bg-sunken p-3">
						<summary class="cursor-pointer text-xs text-ink-secondary">แก้ไขค่าทุกช่อง</summary>

						<form
							method="POST"
							action="?/update"
							class="mt-3 flex flex-col gap-3"
							autocomplete="off"
						>
							<input type="hidden" name="id" value={provider.id} />

							<div class="grid gap-3 sm:grid-cols-2">
								<label class={labelClass}>
									ชื่อที่แสดง
									<input name="label" value={provider.label ?? ''} required class={inputClass} />
								</label>

								<label class={labelClass}>
									ที่อยู่ (base URL)
									<input
										name="base_url"
										value={provider.base_url ?? ''}
										spellcheck="false"
										class={inputClass}
									/>
								</label>
							</div>

							<label class={labelClass}>
								รายชื่อโมเดล (บรรทัดละหนึ่งตัว)
								<textarea name="models" rows="3" class="{inputClass} font-mono"
									>{provider.models.join('\n')}</textarea
								>
							</label>

							<label class={labelClass}>
								กุญแจใหม่ (เว้นว่าง = คงของเดิมไว้)
								<input
									type="password"
									name="api_key"
									autocomplete="new-password"
									placeholder="เว้นว่างถ้าไม่เปลี่ยน"
									class={inputClass}
								/>
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
