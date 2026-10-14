<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>แชทของฉัน</h1>

	<form method="POST" action="?/new">
		<button type="submit">เริ่มแชทใหม่</button>
	</form>

	{#if data.chats.length === 0}
		<p>ยังไม่มีแชท</p>
	{:else}
		<ul>
			{#each data.chats as chat (chat.id)}
				<li>
					<a href={`/chat/${chat.id}`}>{chat.title}</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
