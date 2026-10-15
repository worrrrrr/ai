<script lang="ts">
	let { kind = 'error', message }: { kind?: 'error' | 'success' | 'info'; message: string } =
		$props();

	// ชื่อคลาสต้องเป็นข้อความตรง ๆ เพื่อให้ Tailwind เก็บไว้ในบันเดิล
	const tone = {
		error: 'border-danger bg-danger-soft text-danger',
		success: 'border-success bg-surface text-success',
		info: 'border-line bg-sunken text-ink-secondary'
	};
</script>

<p
	role={kind === 'error' ? 'alert' : 'status'}
	class="rounded-control border px-3 py-2 text-sm {tone[kind]}"
>
	{message}
</p>
