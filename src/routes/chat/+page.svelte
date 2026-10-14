<script lang="ts">
	let { data, form } = $props();
</script>

<main>
	<h1>แชทของฉัน</h1>

	<form method="POST" action="?/new">
		<button type="submit">เริ่มแชทใหม่</button>
	</form>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	{#if data.chats.length === 0}
		<p>ยังไม่มีแชท</p>
	{:else}
		<ul>
			{#each data.chats as chat (chat.id)}
				<li>
					<a href={`/chat/${chat.id}`}>{chat.title}</a>

					<form method="POST" action="?/rename">
						<input type="hidden" name="id" value={chat.id} />
						<input name="title" value={chat.title} aria-label="ชื่อแชท" />
						<button type="submit">เปลี่ยนชื่อ</button>
					</form>

					<form method="POST" action="?/delete">
						<input type="hidden" name="id" value={chat.id} />
						<button type="submit">ลบ</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</main>
