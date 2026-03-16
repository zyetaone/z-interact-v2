<script>
	import { page } from '$app/state';
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
	<p class="font-mono text-6xl font-bold text-white/20">{page.status}</p>
	<p class="text-lg text-slate-400">{page.error?.message || 'Something went wrong'}</p>
	<a
		href="/"
		class="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
	>
		Back to Showcase
	</a>
</div>
