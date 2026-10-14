<script lang="ts">
	import { createAIContext } from '@ai-sdk/svelte';
	import { page } from '$app/state';
	import AppShell from '#lib/components/AppShell.svelte';
	import './layout.css';

	let { children, data } = $props();

	// สร้าง context ของ AI SDK ครั้งเดียวต่อทั้งแอป
	createAIContext();

	// หน้าเข้าสู่ระบบไม่ต้องมี shell — ทางที่สะอาดกว่าคือย้ายหน้าอื่นเข้า route group (app)
	// แล้วเหลือ +layout.svelte ของกลุ่มทำหน้าที่นี้
	const chromeless = $derived(page.url.pathname.startsWith('/auth'));
</script>

{#if chromeless}
	{@render children()}
{:else}
	<AppShell user={data.user} chats={data.chats} settings={data.settings}>
		{@render children()}
	</AppShell>
{/if}
