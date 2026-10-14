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

<button onclick={signInWithGoogle}>Sign in with Google</button>
