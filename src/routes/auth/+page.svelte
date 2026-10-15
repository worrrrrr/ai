<script lang="ts">
	import { supabase } from '#lib/supabase.ts';
	import { page } from '$app/state';

	async function signInWithGoogle() {
		const redirectTo = page.url.searchParams.get('redirectTo') ?? '/';
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
			}
		});
		if (error) console.error(error.message);
	}
</script>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex w-full max-w-sm flex-col items-center gap-6 text-center">
		<div>
			<h1 class="text-xl font-semibold">ยินดีต้อนรับ</h1>
			<p class="mt-2 text-sm text-ink-secondary">เข้าสู่ระบบเพื่อเริ่มใช้งาน</p>
		</div>

		<button
			type="button"
			onclick={signInWithGoogle}
			class="w-full rounded-control bg-brand px-4 py-2 text-sm text-ink-inverted transition-opacity hover:opacity-90"
		>
			เข้าสู่ระบบด้วย Google
		</button>
	</div>
</main>
