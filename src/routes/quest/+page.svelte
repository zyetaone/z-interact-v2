<script lang="ts">
	import { goto } from '$app/navigation';
	import { QuestEngine } from '$lib/quest-engine.svelte';
	import { QUEST_STEPS } from '$lib/config/quest';
	import { Sparkles, ArrowRight, ChevronRight } from '@lucide/svelte';
	import { saveQuest } from './ai.remote';
	import { fly, scale } from 'svelte/transition';

	let { data } = $props();
	const engine = new QuestEngine();

	let chosen = $state<'a' | 'b' | null>(null);
	let saving = $state(false);

	function pick(option: 'a' | 'b') {
		if (chosen) return;
		chosen = option;
		setTimeout(() => {
			engine.choose(option);
			chosen = null;
		}, 400);
	}

	async function finish() {
		saving = true;
		try {
			const choices = engine.results.map((r, i) => {
				const step = QUEST_STEPS[i];
				return {
					step: step.id,
					optionA: step.optionA.name,
					optionB: step.optionB.name,
					selected: engine.choices[i],
					spaceName: r.spaceName,
					imageUrl: r.imageUrl,
					tags: r.tags
				};
			});

			const { spaceIds } = await saveQuest({
				sessionId: data.sessionId,
				choices
			});

			if (spaceIds.length > 0) {
				goto(`/forge/${spaceIds[0]}`);
			} else {
				goto('/');
			}
		} catch {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Workspace Quest — ZyetaDX</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-950 text-white">
	<!-- Progress bar -->
	<div class="fixed top-0 right-0 left-0 z-50">
		<div class="h-1 bg-white/5">
			<div
				class="h-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500 ease-out"
				style="width: {engine.progress * 100}%"
			></div>
		</div>
	</div>

	{#if !engine.isComplete}
		<!-- Quest step -->
		{#key engine.currentStep}
			<div class="flex flex-1 flex-col items-center justify-center px-4 py-16" in:fly={{ y: 40, duration: 400 }}>
				<!-- Category badge -->
				<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5">
					<Sparkles class="h-3.5 w-3.5 text-purple-400" />
					<span class="text-xs font-semibold tracking-wide text-purple-300 uppercase">
						{engine.step?.category}
					</span>
				</div>

				<!-- Step counter -->
				<p class="mb-2 text-sm text-slate-500">
					{engine.currentStep + 1} / {QUEST_STEPS.length}
				</p>

				<!-- Prompt -->
				<h1 class="mb-10 max-w-xl text-center text-2xl font-bold sm:text-3xl">
					{engine.step?.prompt}
				</h1>

				<!-- Option cards -->
				<div class="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
					<!-- Option A -->
					<button
						onclick={() => pick('a')}
						class="group relative overflow-hidden rounded-2xl transition-transform duration-300 focus:outline-none
							{chosen === 'a' ? 'scale-105 ring-2 ring-purple-400' : chosen === 'b' ? 'scale-95 opacity-40' : 'hover:scale-[1.02]'}"
					>
						<div class="aspect-[4/3] w-full">
							<img
								src={engine.step?.optionA.image}
								alt={engine.step?.optionA.name}
								class="h-full w-full object-cover"
							/>
						</div>
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
							<span class="text-lg font-semibold">{engine.step?.optionA.name}</span>
						</div>
					</button>

					<!-- Option B -->
					<button
						onclick={() => pick('b')}
						class="group relative overflow-hidden rounded-2xl transition-transform duration-300 focus:outline-none
							{chosen === 'b' ? 'scale-105 ring-2 ring-purple-400' : chosen === 'a' ? 'scale-95 opacity-40' : 'hover:scale-[1.02]'}"
					>
						<div class="aspect-[4/3] w-full">
							<img
								src={engine.step?.optionB.image}
								alt={engine.step?.optionB.name}
								class="h-full w-full object-cover"
							/>
						</div>
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
							<span class="text-lg font-semibold">{engine.step?.optionB.name}</span>
						</div>
					</button>
				</div>
			</div>
		{/key}
	{:else}
		<!-- Results summary -->
		<div class="flex flex-1 flex-col items-center justify-center px-4 py-16" in:scale={{ duration: 500, start: 0.9 }}>
			<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
				<Sparkles class="h-3.5 w-3.5 text-emerald-400" />
				<span class="text-xs font-semibold tracking-wide text-emerald-300 uppercase">Quest Complete</span>
			</div>

			<h1 class="mb-2 text-center text-3xl font-bold sm:text-4xl">Your Workspace DNA</h1>
			<p class="mb-8 max-w-md text-center text-slate-400">
				These are the spaces that define your ideal workspace. Customize each one in the forge.
			</p>

			<!-- Results grid -->
			<div class="mb-10 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each engine.results as result, i (result.stepId)}
					<div
						class="celebrate overflow-hidden rounded-xl border border-white/10 bg-white/5"
						style="animation-delay: {i * 80}ms"
					>
						<div class="aspect-[4/3]">
							<img
								src={result.imageUrl}
								alt={result.spaceName}
								class="h-full w-full object-cover"
							/>
						</div>
						<div class="p-3">
							<p class="text-sm font-semibold">{result.spaceName}</p>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each result.tags.slice(0, 2) as tag (tag)}
									<span class="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
										{tag}
									</span>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- CTA -->
			<button
				onclick={finish}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:bg-purple-500 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
			>
				{#if saving}
					Saving…
				{:else}
					Start Forging
					<ArrowRight class="h-5 w-5" />
				{/if}
			</button>
		</div>
	{/if}

	<!-- Back to home link -->
	<div class="pb-6 text-center">
		<a href="/" class="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300">
			<ChevronRight class="h-3 w-3 rotate-180" />
			Back to home
		</a>
	</div>
</div>
