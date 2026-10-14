<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';

	let { data } = $props();

	// อ่านค่าตั้งต้นครั้งเดียว (ตั้งใจ ไม่ต้อง reactive) — untrack บอกเจตนานี้กับ compiler
	const { chatId, messages } = untrack(() => data);

	// id ต้องตรงกับแถวในตาราง chats เพื่อให้ /api/chat บันทึกต่อท้ายแชทเดิมได้
	const chat = new Chat({
		id: chatId,
		messages,
		onFinish: () => invalidateAll()
	});

	let input = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text) return;
		chat.sendMessage({ text });
		input = '';
	}
</script>

<main>
	<header>
		<a href="/chat">กลับไปรายการแชท</a>
		<h1>{data.title}</h1>
	</header>

	<ul>
		{#each chat.messages as message (message.id)}
			<li>
				<div>{message.role}</div>
				<div>
					{#each message.parts as part, partIndex (partIndex)}
						{#if part.type === 'text'}
							<div>{part.text}</div>
						{:else if part.type.startsWith('tool-')}
							<pre>{JSON.stringify(part, null, 2)}</pre>
						{/if}
					{/each}
				</div>
			</li>
		{/each}
	</ul>

	<form onsubmit={handleSubmit}>
		<input bind:value={input} />
		<button type="submit" disabled={chat.status !== 'ready'}>Send</button>
	</form>
</main>
