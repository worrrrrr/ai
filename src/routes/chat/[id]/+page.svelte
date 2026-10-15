<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { refreshAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import CopyAll from '@lucide/svelte/icons/copy';
	import ListIcon from '@lucide/svelte/icons/list';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { untrack } from 'svelte';
	import Composer from '#lib/components/Composer.svelte';
	import MessageList from '#lib/components/MessageList.svelte';
	import OrchestrationResult from '#lib/components/OrchestrationResult.svelte';

	let { data } = $props();

	// อ่านค่าตั้งต้นครั้งเดียว (ตั้งใจ ไม่ต้อง reactive) — untrack บอกเจตนานี้กับ compiler
	const { chatId, messages } = untrack(() => data);

	// id ต้องตรงกับแถวในตาราง chats เพื่อให้ /api/chat บันทึกต่อท้ายแชทเดิมได้
	const chat = new Chat({
		id: chatId,
		messages,
		onFinish: () => refreshAll()
	});

	/**
	 * "ใครตอบล่าสุด" — อ่านจาก metadata ของข้อความผู้ช่วยตัวสุดท้าย (โหลดมาจากฐานข้อมูล)
	 * คำนวณใหม่เมื่อข้อมูลโหลดใหม่ จึงอัปเดตหลังตอบเสร็จ · ว่างเมื่อยังไม่มีคำตอบ
	 */
	const answeredBy = $derived.by(() => {
		const list = (data.messages ?? []) as { role: string; metadata?: unknown }[];
		const last = [...list].reverse().find((message) => message.role === 'assistant');
		const metadata = last?.metadata as
			{ provider?: string; model?: string; durationMs?: number | null } | undefined;

		return [metadata?.provider, metadata?.model].filter(Boolean).join(' · ');
	});

	/** บันทึกชื่อใหม่แล้วโหลดข้อมูลหน้าใหม่ (ชื่อจริงมาจากฐานข้อมูล) — ไม่ต้องรีเฟรชทั้งหน้า */
	const renameEnhance: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ invalidateAll: true });
		};
	};

	/** คัดลอกบทสนทนาทั้งแชท (ข้อความผู้ใช้ + ผู้ช่วย เฉพาะส่วนข้อความ) */
	const chatTitle = untrack(() => data.title);
	let copied = $state(false);

	async function copyAll() {
		const text = (
			(data.messages ?? []) as { role: string; parts?: { type: string; text?: string }[] }[]
		)
			.map((message) => {
				const body = (message.parts ?? [])
					.filter((part) => part.type === 'text')
					.map((part) => part.text ?? '')
					.join('\n')
					.trim();
				if (!body) return '';
				return `${message.role === 'user' ? 'คุณ' : 'ผู้ช่วย'}: ${body}`;
			})
			.filter(Boolean)
			.join('\n\n');

		if (!text) return;
		await navigator.clipboard.writeText(`${chatTitle}\n\n${text}`);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	/** ลบแชท (soft delete) — สำเร็จแล้วกลับไปหน้ารายการแชท */
	const deleteEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
				await goto('/chat');
				return;
			}

			await update();
		};
	};
</script>

<header class="flex items-center gap-3 border-b border-line px-4 py-3">
	<!-- ชื่อแชทแก้ได้ทันที (ชื่อเดิมสร้างจากข้อความแรกอัตโนมัติ) — เขียนเฉพาะ chats.title -->
	<form method="POST" action="?/rename" use:enhance={renameEnhance} class="min-w-0 flex-1">
		<input
			name="title"
			value={data.title}
			maxlength="120"
			aria-label="ชื่อแชท (แก้ได้)"
			title="แก้ชื่อแชทได้"
			class="w-full truncate rounded-control border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium transition-colors hover:border-line focus:border-edge"
		/>
	</form>

	{#if answeredBy}
		<span
			class="hidden shrink-0 rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted sm:inline"
		>
			{answeredBy}
		</span>
	{/if}

	<!-- การกระทำของแชท (ไม่ใช่การนำทาง — แถบข้างทำหน้าที่นั้นอยู่แล้ว) -->
	<button
		type="button"
		class="ms-auto shrink-0 rounded-control p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
		aria-label="คัดลอกทั้งแชท"
		title={copied ? 'คัดลอกแล้ว' : 'คัดลอกทั้งแชท'}
		onclick={copyAll}
	>
		{#if copied}
			<Check size={15} strokeWidth={1.75} class="text-brand" />
		{:else}
			<CopyAll size={15} strokeWidth={1.75} />
		{/if}
	</button>

	<a
		class="shrink-0 rounded-control p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
		href="/chat"
		aria-label="รายการแชท"
		title="รายการแชท"
	>
		<ListIcon size={15} strokeWidth={1.75} />
		<form method="POST" action="?/delete" use:enhance={deleteEnhance} class="shrink-0">
			<button
				type="submit"
				class="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
				aria-label="ลบแชทนี้"
				title="ลบแชทนี้ (เก็บประวัติไว้)"
				onclick={(event) => {
					if (!confirm('ลบแชทนี้? ข้อความทั้งหมดยังถูกเก็บไว้ แต่จะไม่แสดงในรายการ')) {
						event.preventDefault();
					}
				}}
			>
				<Trash2 size={15} strokeWidth={1.75} />
			</button>
		</form>
	</a>
</header>

{#if data.orchestration}
	<!-- ร่องรอยของรอบ "ทีมเอเจนต์": ใครตอบอะไร ใครล้ม ใช้เวลาเท่าไร (ย่อไว้เป็นค่าเริ่มต้น) -->
	<details class="border-b border-line px-4 py-2">
		<summary class="cursor-pointer text-xs text-ink-secondary">
			ร่องรอยของทีม ({data.orchestration.answers.length} คน · หัวหน้า {data.orchestration
				.leadName || 'ไม่ทราบชื่อ'})
		</summary>

		<div class="pt-3">
			<OrchestrationResult
				view={data.orchestration}
				{chatId}
				showChatLink={false}
				running={false}
			/>
		</div>
	</details>
{/if}

<MessageList messages={chat.messages} status={chat.status} />

<Composer {chat} />
