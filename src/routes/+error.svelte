<script lang="ts">
	import { page } from '$app/state';

	/** ข้อความไทยที่อ่านรู้เรื่อง — ไม่โชว์ stack/ข้อความดิบของผู้ให้บริการให้ผู้ใช้เห็น */
	const isNotFound = $derived(page.status === 404);
	const title = $derived(isNotFound ? 'ไม่พบหน้านี้' : 'เกิดข้อผิดพลาด');
	const detail = $derived(
		isNotFound
			? 'ลิงก์อาจเปลี่ยนไปแล้ว หรือรายการนี้ถูกลบ — กลับไปเริ่มจากหน้าแรกได้เลย'
			: (page.error?.message ?? 'ลองใหม่อีกครั้ง ถ้ายังไม่หายให้ตรวจ log ของเซิร์ฟเวอร์')
	);
</script>

<main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
	<p class="font-mono text-xs text-ink-muted">ข้อผิดพลาด {page.status}</p>
	<h1 class="text-lg font-semibold">{title}</h1>
	<p class="max-w-md text-sm text-ink-secondary">{detail}</p>

	<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
		<a
			href="/"
			class="rounded-control bg-brand px-3 py-1.5 text-xs text-ink-inverted transition-colors hover:bg-brand-strong"
		>
			กลับหน้าแรก
		</a>
		<a
			href="/chat"
			class="rounded-control border border-line px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover hover:text-ink"
		>
			รายการแชท
		</a>
	</div>
</main>
