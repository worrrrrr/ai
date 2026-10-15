<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import X from '@lucide/svelte/icons/x';
	import Bot from '@lucide/svelte/icons/bot';
	import Calculator from '@lucide/svelte/icons/calculator';
	import CloudSun from '@lucide/svelte/icons/cloud-sun';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Search from '@lucide/svelte/icons/search';
	import Users from '@lucide/svelte/icons/users';
	import Composer from '#lib/components/Composer.svelte';
	import MessageList from '#lib/components/MessageList.svelte';
	import OrchestrationResult, {
		type OrchestrationView
	} from '#lib/components/OrchestrationResult.svelte';

	let { data, form } = $props();

	// สร้าง id ฝั่ง client แล้วส่งไปกับ request — /api/chat จะสร้างแถว chat ให้เอง (ensureChat)
	// โหมดทีมใช้ id เดียวกัน เพื่อให้คำตอบรวมถูกบันทึกลงแชทเดียวกัน
	const chatId = crypto.randomUUID();
	let navigated = false;

	const chat = new Chat({
		id: chatId,
		// จบคำตอบแรกแล้วไปที่ URL ประจำแชท (refresh แล้วประวัติยังอยู่)
		// ถ้าคำขอพลาด ห้ามเด้ง — ไม่งั้นจะไปเจอ 404 ที่สับสน
		onFinish: ({ isError }) => {
			if (isError || navigated) return;
			navigated = true;
			void goto(`/chat/${chatId}`);
		}
	});

	/** ข้อความในช่องพิมพ์ — ใช้ร่วมกันทั้งโหมดเดี่ยวและโหมดทีม */
	let draft = $state('');

	const suggestions = [
		{ icon: Calculator, label: 'ช่วยคิดเลข 128 × 46 ให้หน่อย' },
		{ icon: Search, label: 'ค้นหาเรื่องที่อยากรู้จากเว็บ' },
		{ icon: CloudSun, label: 'อากาศที่กรุงเทพตอนนี้เป็นยังไง' }
	];

	/** โหมด: แชทเดี่ยว (สตรีมปกติ) หรือ ทีมเอเจนต์ (orchestrator) */
	let mode = $state<'single' | 'team'>('single');

	// --- โหมดทีม ---
	let pickedIds = $state<string[]>([]);
	let leadId = $state('');
	let running = $state(false);
	let teamError = $state<string | null>(null);
	/** ผลของรอบที่กำลังสตรีม/จบแล้ว (API ส่ง NDJSON ทีละขั้น) */
	let view = $state<OrchestrationView | null>(null);
	/** ทีมของรอบที่กำลังรัน — รู้ตั้งแต่ก่อนยิง จึงโชว์ได้ว่ารอใครอยู่ */
	let teamMembers = $state<{ id: string; name: string; isLead: boolean }[]>([]);
	/** ฟอร์มบันทึกทีมถาวร (เปิดเมื่อผู้ใช้กด) */
	let saveOpen = $state(false);

	/** ข้อความตอบกลับจาก action ของหน้าทีม (ok/message) — อ่านแบบปลอดภัยต่อชนิด */
	const teamFeedback = $derived(
		form && typeof form === 'object' ? (form as { ok?: string; message?: string }) : null
	);

	/** ป้ายและสีของสถานะรอบ (ค่ามาจาก presentRunStatus ฝั่ง server) */
	const runLabels: Record<string, string> = {
		done: 'เสร็จ',
		failed: 'ล้ม',
		partial: 'หยุดกลางคัน',
		running: 'กำลังทำ…',
		planning: 'กำลังทำ…'
	};
	const runClasses: Record<string, string> = {
		done: 'text-brand',
		failed: 'text-danger',
		partial: 'text-ink-secondary',
		running: 'text-ink-muted',
		planning: 'text-ink-muted'
	};
	const runLabel = (status: string) => runLabels[status] ?? status;
	const runClass = (status: string) => runClasses[status] ?? 'text-ink-muted';

	/** เลือกทีมถาวร = ติ๊กสมาชิกทั้งทีม + ตั้งหัวหน้าตามที่บันทึกไว้ */
	function applyTeam(team: { members: { id: string; isLead: boolean }[] }) {
		pickedIds = team.members.map((member) => member.id);
		leadId = team.members.find((member) => member.isLead)?.id ?? team.members[0]?.id ?? '';
	}

	/** หลังบันทึก/ลบทีม: รีเฟรช data ของหน้า เพื่อให้ชิปตรงกับฐานข้อมูลจริง */
	const refreshAfterTeamChange: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ invalidateAll: true });
			saveOpen = false;
		};
	};

	function toggleMember(id: string) {
		if (pickedIds.includes(id)) {
			pickedIds = pickedIds.filter((picked) => picked !== id);
			if (leadId === id) leadId = '';
		} else {
			pickedIds = [...pickedIds, id];
			if (!leadId) leadId = id;
		}
	}

	/** อัปเดตมุมมองจากเหตุการณ์หนึ่งบรรทัดของ NDJSON */
	function applyEvent(event: Record<string, unknown>) {
		if (!view) return;

		switch (event.type) {
			case 'plan':
				view = { ...view, plan: String(event.plan ?? ''), leadName: String(event.lead ?? '') };
				break;

			case 'answer':
				view = {
					...view,
					answers: [
						...view.answers,
						{
							name: String(event.agentName ?? ''),
							content: String(event.content ?? ''),
							error: (event.error as string | null) ?? null,
							durationMs: Number(event.durationMs ?? 0)
						}
					]
				};
				break;

			case 'done':
				view = {
					...view,
					merged: String(event.merged ?? ''),
					error: (event.error as string | null) ?? null,
					summary: (event.summary as OrchestrationView['summary']) ?? null
				};
				break;

			case 'error':
				teamError = String(event.message ?? 'รอบนี้ล้มกลางทาง');
				break;
		}
	}

	async function runTeam() {
		const prompt = draft.trim();
		teamError = null;

		if (pickedIds.length === 0) {
			teamError = 'เลือกเอเจนต์อย่างน้อย 1 ตัวก่อน';
			return;
		}
		if (!prompt) {
			teamError = 'พิมพ์คำถามก่อน';
			return;
		}

		running = true;
		view = { plan: '', leadName: '', answers: [], merged: '', error: null, summary: null };
		teamMembers = data.agents
			.filter((agent) => pickedIds.includes(agent.id))
			.map((agent) => ({ id: agent.id, name: agent.name, isLead: agent.id === leadId }));

		try {
			const response = await fetch('/api/chat/orchestrate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id: chatId,
					prompt,
					agentIds: pickedIds,
					leadAgentId: leadId || undefined
				})
			});

			const contentType = response.headers.get('content-type') ?? '';

			// ขั้นต้นทางผิด = JSON ปกติ (401/400/500) — อ่านเป็น JSON แล้วบอกผู้ใช้ตรง ๆ
			if (!response.ok || !contentType.includes('ndjson')) {
				const payload = (await response.json().catch(() => null)) as { error?: string } | null;
				teamError = payload?.error ?? `เรียกทีมไม่สำเร็จ (HTTP ${response.status})`;
				view = null;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				teamError = 'เบราว์เซอร์นี้อ่านสตรีมไม่ได้';
				view = null;
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';

			// อ่านทีละบรรทัด: แต่ละบรรทัดคือความคืบหน้าหนึ่งขั้น
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						applyEvent(JSON.parse(line) as Record<string, unknown>);
					} catch {
						// บรรทัดที่อ่านไม่ได้ (ถูกตัดกลางคัน) — ข้าม ไม่ให้ทั้งรอบล้ม
					}
				}
			}

			draft = '';
		} catch (error) {
			teamError = error instanceof Error ? error.message : 'เชื่อมต่อไม่สำเร็จ';
		} finally {
			running = false;
		}
	}
</script>

<main class="scroll-slim min-h-0 flex-1 overflow-y-auto">
	<div
		class="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8"
	>
		<!-- สลับโหมด: เดี่ยว / ทีมเอเจนต์ -->
		<div class="flex gap-1 rounded-panel border border-line bg-surface p-1">
			<button
				type="button"
				onclick={() => (mode = 'single')}
				aria-pressed={mode === 'single'}
				class="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs transition-colors"
				class:bg-brand-soft={mode === 'single'}
				class:font-medium={mode === 'single'}
				class:text-ink={mode === 'single'}
				class:text-ink-secondary={mode !== 'single'}
			>
				<MessageSquare size={14} strokeWidth={1.75} />
				แชทเดี่ยว
			</button>

			<button
				type="button"
				onclick={() => (mode = 'team')}
				aria-pressed={mode === 'team'}
				class="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs transition-colors"
				class:bg-brand-soft={mode === 'team'}
				class:font-medium={mode === 'team'}
				class:text-ink={mode === 'team'}
				class:text-ink-secondary={mode !== 'team'}
			>
				<Users size={14} strokeWidth={1.75} />
				ทีมเอเจนต์
				{#if data.agents.length > 0}
					<span class="text-[11px] text-ink-muted">({data.agents.length})</span>
				{/if}
			</button>
		</div>

		{#if data.runs.length > 0}
			<!-- รอบล่าสุด: เห็นว่าอะไรจบ/กำลังทำ/หยุดกลางคัน โดยไม่ต้องเข้าแชทก่อน (พับไว้ให้หน้าโล่ง) -->
			<details class="w-full">
				<summary class="cursor-pointer text-xs text-ink-secondary">
					รอบล่าสุด ({data.runs.length})
				</summary>

				<ul class="mt-3 flex flex-col gap-2">
					{#each data.runs as run (run.id)}
						<li
							class="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2 text-xs"
						>
							<span class={runClass(run.status)}>{runLabel(run.status)}</span>
							<span class="min-w-0 flex-1 truncate text-ink-secondary" title={run.title}>
								{run.title}
							</span>
							{#if run.chatId}
								<a class="shrink-0 text-brand underline" href={`/chat/${run.chatId}`}>เปิดร่องรอย</a
								>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}

		{#if data.agent}
			<div
				class="flex items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2 text-xs"
			>
				<Bot size={14} strokeWidth={1.75} class="text-ink-secondary" />
				<span class="text-ink-secondary">
					กำลังคุยกับเอเจนต์ <strong class="font-medium text-ink">{data.agent.name}</strong>
					<span class="font-mono text-ink-muted">· {data.agent.model}</span>
				</span>
				<a class="ms-2 text-brand underline" href="/">เอาออก</a>
			</div>
		{/if}

		<h1 class="text-2xl font-semibold">
			{mode === 'single' ? 'เริ่มจากตรงไหนดี?' : 'ให้ทีมช่วยตอบ'}
		</h1>

		{#if mode === 'single'}
			<!-- พอมีข้อความแล้ว ให้เห็นคำตอบที่กำลังสตรีมทันที (เดิมหน้าแรกเงียบ จนจบแล้วเด้งไปหน้าแชท) -->
			{#if chat.messages.length > 0}
				<div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
					<MessageList messages={chat.messages} status={chat.status} />
				</div>
			{/if}

			<div class="w-full">
				<Composer
					{chat}
					layout={chat.messages.length > 0 ? 'dock' : 'hero'}
					placeholder="ถามอะไรก็ได้…"
					agentId={data.agent?.id ?? ''}
					bind:value={draft}
				/>
			</div>
		{:else}
			<div class="flex w-full flex-col gap-3 rounded-panel border border-line bg-surface p-4">
				{#if teamFeedback?.ok}
					<p class="text-xs text-brand">{teamFeedback.ok}</p>
				{/if}
				{#if teamFeedback?.message}
					<p class="text-xs text-danger">{teamFeedback.message}</p>
				{/if}

				{#if data.teams.length > 0}
					<!-- ทีมถาวร: กดชื่อ = ติ๊กสมาชิกทั้งทีมทันที -->
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-[11px] text-ink-muted">ทีมที่บันทึกไว้</span>
						{#each data.teams as team (team.id)}
							<span
								class="flex items-center gap-1 rounded-control border border-line bg-sunken px-2 py-1 text-[11px]"
							>
								<button
									type="button"
									onclick={() => applyTeam(team)}
									title="เลือกทีมนี้"
									class="text-ink-secondary transition-colors hover:text-ink"
								>
									{team.name}
								</button>
								<span class="text-ink-muted">({team.members.length})</span>
								{#if team.missing > 0}
									<span class="text-danger" title="เอเจนต์ถูกลบไปแล้ว {team.missing} ตัว">
										-{team.missing}
									</span>
								{/if}
								<form method="POST" action="?/deleteTeam" use:enhance={refreshAfterTeamChange}>
									<input type="hidden" name="team_id" value={team.id} />
									<button
										type="submit"
										aria-label="ลบทีม {team.name}"
										class="text-ink-muted transition-colors hover:text-danger"
									>
										<X size={12} strokeWidth={2} />
									</button>
								</form>
							</span>
						{/each}
					</div>
				{/if}

				{#if pickedIds.length > 0}
					{#if saveOpen}
						<form
							method="POST"
							action="?/saveTeam"
							use:enhance={refreshAfterTeamChange}
							class="flex flex-wrap items-end gap-2 rounded-panel border border-line bg-sunken p-3"
						>
							<label class="flex min-w-40 flex-1 flex-col gap-1 text-xs text-ink-muted">
								ชื่อทีม
								<input
									name="name"
									required
									maxlength="60"
									placeholder="ทีมรีวิวโค้ด"
									class="w-full rounded-control border border-line bg-transparent px-2 py-1 text-sm text-ink focus:border-edge"
								/>
							</label>
							<input type="hidden" name="agent_ids" value={pickedIds.join(',')} />
							<input type="hidden" name="lead_agent_id" value={leadId} />
							<button
								type="submit"
								class="rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
							>
								บันทึกทีมนี้
							</button>
							<button
								type="button"
								onclick={() => (saveOpen = false)}
								class="rounded-control px-2 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
							>
								ยกเลิก
							</button>
						</form>
					{:else}
						<button
							type="button"
							onclick={() => (saveOpen = true)}
							class="self-start text-xs text-brand underline"
						>
							บันทึก {pickedIds.length} ตัวนี้เป็นทีมไว้ใช้ซ้ำ
						</button>
					{/if}
				{/if}

				<div class="flex items-center justify-between gap-2">
					<p class="text-xs font-medium text-ink-secondary">
						เลือกผู้เชี่ยวชาญ (สูงสุด 4) · ติ๊ก “หัวหน้า” = คนที่รวมคำตอบ
					</p>
					{#if pickedIds.length > 0}
						<button
							type="button"
							onclick={() => {
								pickedIds = [];
								leadId = '';
							}}
							class="text-[11px] text-ink-muted hover:text-ink"
						>
							ล้างที่เลือก
						</button>
					{/if}
				</div>

				{#if data.agents.length === 0}
					<p class="text-xs text-ink-muted">
						ยังไม่มีเอเจนต์ — สร้างก่อนที่ <a class="text-brand underline" href="/agent"
							>หน้าเอเจนต์</a
						>
					</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each data.agents as agent (agent.id)}
							{@const picked = pickedIds.includes(agent.id)}
							<li
								class="flex flex-wrap items-center gap-2 rounded-control border px-2 py-1.5 transition-colors"
								class:border-brand={picked}
								class:border-line={!picked}
							>
								<label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs">
									<input
										type="checkbox"
										checked={picked}
										onchange={() => toggleMember(agent.id)}
										class="size-3.5"
									/>
									<span class="truncate">{agent.name}</span>
									<span class="font-mono text-[11px] text-ink-muted">{agent.model}</span>
								</label>

								<label
									class="flex shrink-0 items-center gap-1 text-[11px]"
									class:text-ink={picked}
									class:text-ink-muted={!picked}
								>
									<input
										type="radio"
										name="lead"
										checked={leadId === agent.id}
										disabled={!picked}
										onchange={() => (leadId = agent.id)}
										class="size-3.5"
									/>
									หัวหน้า
								</label>
							</li>
						{/each}
					</ul>
				{/if}

				<label class="flex flex-col gap-1 text-xs text-ink-muted">
					คำถามของรอบนี้
					<textarea
						bind:value={draft}
						rows="3"
						maxlength="8000"
						placeholder="เช่น สรุปข้อดี/ข้อเสียของงานชิ้นนี้ แล้วเสนอทางเลือกที่ควรทำต่อ"
						class="w-full rounded-control border border-line bg-transparent px-2 py-1 text-sm text-ink focus:border-edge"
					></textarea>
				</label>

				{#if teamError}
					<p
						role="alert"
						class="rounded-control border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
					>
						{teamError}
					</p>
				{/if}

				<button
					type="button"
					onclick={runTeam}
					disabled={running || pickedIds.length === 0 || !draft.trim()}
					class="self-start rounded-control bg-brand px-4 py-2 text-sm text-ink-inverted transition-colors hover:bg-brand-strong disabled:opacity-50"
				>
					{running ? 'กำลังถามทีม…' : 'ถามทีม'}
				</button>

				{#if running}
					<p class="text-[11px] text-ink-muted">
						ยิงพร้อมกันทุกคนแล้วรอผล — ตัวที่ใช้เวลาเกิน 60 วินาทีจะถือว่าล้ม แต่รอบยังจบได้
					</p>
				{/if}
			</div>

			{#if view}
				<!-- พับร่องรอยไว้เมื่อทำงานจบ (เปิดอัตโนมัติระหว่างรัน) — ลดความยาวหน้าโดยไม่ต้องเลื่อนหา -->
				<details class="w-full" open={running}>
					<summary class="cursor-pointer text-xs text-ink-secondary">
						ร่องรอยของทีม ({view.answers.length} คน · หัวหน้า {view.leadName || 'ไม่ทราบชื่อ'})
					</summary>

					<div class="pt-3">
						<OrchestrationResult {view} {chatId} members={teamMembers} {running} />
					</div>
				</details>
			{/if}
		{/if}

		{#if mode === 'single'}
			<ul class="flex w-full flex-col gap-1">
				{#each suggestions as suggestion (suggestion.label)}
					{@const Icon = suggestion.icon}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-control px-3 py-2 text-start text-sm text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
							onclick={() => (draft = suggestion.label)}
						>
							<Icon size={18} strokeWidth={1.75} />
							{suggestion.label}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
