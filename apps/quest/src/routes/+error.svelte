<script lang="ts">
	import { page } from '$app/state';
	import { Sparkles, Home } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Error — ZyetaDX</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
	<div class="mb-6 inline-flex items-center justify-center rounded-2xl bg-red-500/20 p-4">
		<Sparkles class="h-8 w-8 text-red-300" />
	</div>

	<h1 class="mb-2 text-center text-4xl font-bold">
		{page.status}
	</h1>
	<p class="mb-8 max-w-md text-center text-lg text-slate-400">
		{page.error?.message || 'Something went wrong.'}
	</p>

	<a
		href="/"
		class="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500"
	>
		<Home class="h-5 w-5" />
		Back to Home
	</a>
</div>
