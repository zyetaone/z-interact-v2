<script lang="ts">
	import { Sparkles, ArrowRight, Globe, Hammer, Fingerprint } from '@lucide/svelte';
	import { ARCHETYPES } from '$lib/config/archetypes';

	let { data } = $props();

	const archetypeInfo = $derived(ARCHETYPES.find((a) => a.key === data.archetype));
</script>

<svelte:head>
	<title>Workspace Quest — ZyetaDX</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-950 text-white">
	<!-- Header -->
	<header class="pointer-events-none fixed top-0 right-0 left-0 z-30 flex justify-center px-6 pt-6">
		<div class="glass pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5">
			<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20">
				<Sparkles class="h-3.5 w-3.5 text-purple-300" />
			</div>
			<span class="text-sm font-semibold">
				<span class="text-purple-400">Zyeta</span><span class="text-white">DX</span>
				<span class="ml-1 text-xs font-normal text-slate-400">Studio</span>
			</span>
		</div>
	</header>

	{#if data.hasSession && data.questCompleted}
		<!-- Returning user with completed quest -->
		<main class="flex flex-1 flex-col items-center justify-center px-6 pt-20 pb-12">
			{#if archetypeInfo}
				<div
					class="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5"
				>
					<Fingerprint class="h-3.5 w-3.5 text-purple-400" />
					<span class="text-xs font-semibold tracking-wide text-purple-300 uppercase">
						{archetypeInfo.name}
					</span>
				</div>
			{/if}

			<h1 class="mb-2 text-center text-4xl font-bold sm:text-5xl">Welcome Back</h1>
			<p class="mb-10 max-w-md text-center text-lg text-slate-400">
				{#if archetypeInfo}
					{archetypeInfo.description}
				{:else}
					Your workspace is taking shape. Continue forging or explore the world.
				{/if}
			</p>

			<!-- Spaces overview -->
			{#if data.spaces.length > 0}
				<div class="mb-10 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{#each data.spaces as space (space.id)}
						<a
							href="/forge/{space.id}"
							class="smooth-transition group overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:border-purple-500/30"
						>
							<div class="aspect-[4/3]">
								<img src={space.imageUrl} alt={space.name} class="h-full w-full object-cover" />
							</div>
							<div class="p-3">
								<p class="text-sm font-semibold">{space.name}</p>
								<span
									class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]
									{space.status === 'complete'
										? 'bg-emerald-500/10 text-emerald-300'
										: space.status === 'forging'
											? 'bg-amber-500/10 text-amber-300'
											: 'bg-slate-500/10 text-slate-400'}"
								>
									{space.status}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/forge/{data.spaces[0]?.id ?? ''}"
					class="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500"
				>
					<Hammer class="h-5 w-5" />
					Continue Forging
				</a>
				<a
					href="/world"
					class="glass smooth-transition inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-3 text-lg font-semibold text-emerald-200 hover:scale-105 hover:bg-emerald-500/20"
				>
					<Globe class="h-5 w-5" />
					Enter World
				</a>
			</div>
		</main>
	{:else}
		<!-- New user -->
		<main class="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
			<!-- Background effect -->
			<div class="absolute inset-0 -z-10">
				<div
					class="absolute inset-0 scale-110 opacity-15 blur-3xl saturate-50"
					style="background-image: url('/assets/WS 01.jpg'); background-size: cover; background-position: center;"
				></div>
				<div
					class="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950"
				></div>
			</div>

			<div class="mb-6 inline-flex items-center justify-center rounded-2xl bg-purple-500/20 p-4">
				<Sparkles class="h-8 w-8 text-purple-300" />
			</div>

			<h1 class="mb-3 text-center text-4xl font-extrabold tracking-tight sm:text-6xl">
				Workspace Quest
			</h1>
			<p class="mb-10 max-w-lg text-center text-lg text-slate-400">
				Design your ideal workspace through an interactive quest. Make 5 choices, forge your spaces
				with AI, and explore them in 3D.
			</p>

			<a
				href="/quest"
				class="pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-10 py-4 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-purple-500"
			>
				Start Quest
				<ArrowRight class="h-6 w-6" />
			</a>
		</main>
	{/if}
</div>
