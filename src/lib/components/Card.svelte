<script>
	let {
		variant = 'default', // 'default' | 'glow' | 'glass' | 'gradient-border' | 'flat' | 'outline'
		padding = 'normal', // 'none' | 'small' | 'normal' | 'large'
		hoverable = false,
		image = '', // URL รูป Cover ด้านบน
		badge = '', // ข้อความ Badge เช่น "NEW", "PRO"
		badgeColor = 'indigo', // 'indigo' | 'green' | 'amber' | 'rose'
		header,
		children,
		footer,
		class: customClass = ''
	} = $props();

	// Variant Mapping
	const variantClasses = {
		default:
			'bg-white border border-slate-200/80 shadow-md dark:bg-slate-900 dark:border-slate-800/80 dark:shadow-slate-950/50',
		glow: 'bg-slate-900 text-white border border-indigo-500/30 shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)] hover:shadow-[0_0_35px_0px_rgba(99,102,241,0.4)] dark:bg-slate-900/90',
		glass:
			'bg-white/60 backdrop-blur-md border border-white/40 shadow-lg dark:bg-slate-900/50 dark:border-slate-700/40 dark:shadow-slate-950/50',
		'gradient-border':
			'relative bg-slate-900 p-[1px] rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-xl',
		flat: 'bg-slate-100/80 border border-transparent dark:bg-slate-800/60',
		outline: 'bg-transparent border-2 border-slate-300 dark:border-slate-700'
	};

	// Badge Mapping
	const badgeClasses = {
		indigo:
			'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400',
		green:
			'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
		amber:
			'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
		rose: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400'
	};

	// Padding Mapping
	const paddingClasses = {
		none: 'p-0',
		small: 'p-3.5',
		normal: 'p-5',
		large: 'p-7'
	};
</script>

<!-- Main Card Wrapper -->
<div
	class="group relative overflow-hidden rounded-2xl text-slate-800 transition-all duration-300 dark:text-slate-100 {variant !==
	'gradient-border'
		? variantClasses[variant]
		: ''} {hoverable ? 'hover:-translate-y-1.5 hover:shadow-2xl' : ''} {customClass}"
>
	<!-- Inner Content Wrapper (กรณีใช้ gradient-border) -->
	<div
		class="h-full w-full rounded-[15px] {variant === 'gradient-border' ? 'bg-slate-900 p-5' : ''}"
	>
		<!-- Cover Image Slot -->
		{#if image}
			<div
				class="relative -mx-5 -mt-5 mb-4 overflow-hidden transition-opacity group-hover:opacity-95"
			>
				<img
					src={image}
					alt="Card Cover"
					class="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>
				{#if badge}
					<span
						class="absolute top-3 right-3 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-md {badgeClasses[
							badgeColor
						]}"
					>
						{badge}
					</span>
				{/if}
			</div>
		{:else if badge}
			<!-- Badge เดี่ยวๆ กรณีไม่มีรูป Cover -->
			<div class="mb-2 flex justify-end">
				<span
					class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase {badgeClasses[
						badgeColor
					]}"
				>
					{badge}
				</span>
			</div>
		{/if}

		<!-- Header -->
		{#if header}
			<div class="mb-3 border-b border-slate-100 pb-3 dark:border-slate-800/80">
				{@render header()}
			</div>
		{/if}

		<!-- Body / Children -->
		{#if children}
			<div
				class="text-sm leading-relaxed text-slate-600 dark:text-slate-300 {variant ===
				'gradient-border'
					? 'p-0'
					: paddingClasses[padding]}"
			>
				{@render children()}
			</div>
		{/if}

		<!-- Footer -->
		{#if footer}
			<div class="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/80">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>
