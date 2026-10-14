<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>เข้าสู่ระบบไม่สำเร็จ</h1>
	<p>สาเหตุ: {data.reason}</p>
	<p><a href="/auth">กลับไปหน้าเข้าสู่ระบบ</a></p>
</main>
