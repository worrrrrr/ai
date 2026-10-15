<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions,
		children
	}: {
		title: string;
		description?: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="rounded-panel border border-line bg-surface p-4">
	<header class="flex flex-wrap items-start justify-between gap-2">
		<div class="min-w-0">
			<h2 class="text-sm font-semibold">{title}</h2>
			{#if description}
				<p class="mt-1 text-xs text-ink-muted">{description}</p>
			{/if}
		</div>

		{#if actions}
			{@render actions()}
		{/if}
	</header>

	<div class="mt-4">
		{@render children()}
	</div>
</section>
