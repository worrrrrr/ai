<script lang="ts" module>
	/** มุมมองผลของรอบ orchestrator — ใช้ได้ทั้งตอนกำลังสตรีม (บางส่วน) และตอนจบแล้ว */
	export type OrchestrationView = {
		plan: string;
		leadName: string;
		answers: { name: string; content: string; error: string | null; durationMs: number }[];
		merged: string;
		error: string | null;
		summary: { answered: number; failed: number; totalMs: number } | null;
	};
</script>

<script lang="ts">
	let {
		view,
		chatId,
		members = [],
		running = false,
		showChatLink = true
	}: {
		view: OrchestrationView;
		chatId: string;
		/** ทีมของรอบนี้ (รู้ตั้งแต่ก่อนยิง) — ใช้โชว์ว่ารอใครอยู่ ใครเสร็จ ใครล้ม */
		members?: { id: string; name: string; isLead?: boolean }[];
		running?: boolean;
		/** หน้าแชทไม่ต้องมีลิงก์ "เปิดในประวัติแชท" เพราะอยู่หน้านั้นแล้ว */
		showChatLink?: boolean;
	} = $props();

	function seconds(ms: number): string {
		return `${(ms / 1000).toFixed(1)} วิ`;
	}
</script>

<div class="flex w-full flex-col gap-3 text-start">
	{#if members.length > 0}
		<!-- รายการงานระหว่างทาง (แบบ todo ของ DSH): รอ/กำลังทำ · เสร็จ · ล้ม -->
		<ul class="flex flex-wrap gap-2">
			{#each members as member (member.id)}
				{@const answer = view.answers.find((item) => item.name === member.name)}
				{@const status = !answer ? 'pending' : answer.error ? 'failed' : 'done'}
				<li
					class="flex items-center gap-1.5 rounded-control border px-2 py-1 text-[11px]"
					class:border-line={status === 'pending'}
					class:border-brand={status === 'done'}
					class:border-danger={status === 'failed'}
				>
					<span class="text-ink-secondary">
						{member.name}{member.isLead ? ' (หัวหน้า)' : ''}
					</span>
					{#if status === 'pending'}
						<span class="text-ink-muted">กำลังทำ…</span>
					{:else if status === 'failed'}
						<span class="text-danger">ล้ม</span>
					{:else}
						<span class="text-brand">เสร็จ</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if view.plan}
		<div class="rounded-panel border border-line bg-sunken p-3">
			<h2 class="text-xs font-semibold text-ink-secondary">แผนของรอบนี้</h2>
			<p class="mt-1 text-xs text-ink-secondary">{view.plan}</p>
		</div>
	{/if}

	{#if view.answers.length > 0}
		<ul class="flex flex-col gap-2">
			{#each view.answers as answer (answer.name)}
				<li class="rounded-panel border border-line bg-surface p-3">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs font-medium">{answer.name}</span>
						{#if answer.error}
							<span class="rounded-control bg-danger-soft px-1.5 py-0.5 text-[11px] text-danger">
								ล้ม: {answer.error}
							</span>
						{:else}
							<span class="text-[11px] text-ink-muted">{seconds(answer.durationMs)}</span>
						{/if}
					</div>

					<p class="mt-2 text-xs whitespace-pre-wrap text-ink-secondary">
						{answer.content.trim() || '— ไม่มีเนื้อหา —'}
					</p>
				</li>
			{/each}
		</ul>
	{/if}

	{#if view.merged.trim()}
		<div class="rounded-panel border border-brand bg-surface p-4">
			<h2 class="text-sm font-semibold">
				คำตอบรวม
				<span class="text-xs font-normal text-ink-muted">
					โดยหัวหน้า {view.leadName || 'ไม่ทราบชื่อ'}
				</span>
			</h2>
			<p class="mt-2 text-sm whitespace-pre-wrap">{view.merged}</p>
		</div>
	{:else if !running}
		<div class="rounded-panel border border-danger bg-surface p-3">
			<h2 class="text-xs font-semibold text-danger">ไม่มีคำตอบรวม</h2>
			<p class="mt-1 text-xs text-ink-secondary">{view.error ?? 'ไม่มีเอเจนต์ตัวใดตอบสำเร็จ'}</p>
		</div>
	{:else}
		<p class="text-xs text-ink-muted">กำลังรอหัวหน้ารวมคำตอบ…</p>
	{/if}

	<div class="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
		{#if running}
			<span>กำลังทำงาน… {view.answers.length} คนตอบแล้ว</span>
		{:else if view.summary}
			<span>
				ตอบ {view.summary.answered} · ล้ม {view.summary.failed} · ใช้เวลา {seconds(
					view.summary.totalMs
				)}
			</span>
		{/if}

		{#if view.merged.trim() && showChatLink}
			<a class="text-brand underline" href={`/chat/${chatId}`}>เปิดในประวัติแชท</a>
		{/if}
	</div>
</div>
