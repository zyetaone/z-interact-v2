<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { QuestEngine } from '$lib/quest-engine.svelte';
	import { QUEST_STEPS } from '$lib/config/quest';
	import { computeArchetype, type Archetype } from '$lib/config/archetypes';
	import CinematicModal from '$lib/components/CinematicModal.svelte';
	import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, Fingerprint } from '@lucide/svelte';
	import { saveQuest } from './ai.remote';
	import { fly, scale } from 'svelte/transition';

	const QUEST_STORAGE_KEY = 'quest-choices';

	const engine = new QuestEngine();

	// Restore saved choices synchronously before first render (browser-only)
	if (browser) {
		try {
			const saved = sessionStorage.getItem(QUEST_STORAGE_KEY);
			if (saved) {
				const parsed: ('a' | 'b')[] = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					for (const choice of parsed) {
						if (choice === 'a' || choice === 'b') {
							engine.choose(choice);
						}
					}
				}
			}
		} catch {
			// Ignore parse errors — start fresh
		}
	}

	// Persist choices to sessionStorage whenever they change
	$effect(() => {
		const choices = engine.choices;
		if (!browser) return;
		try {
			if (choices.length > 0) {
				sessionStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(choices));
			}
		} catch {
			// Ignore storage errors
		}
	});

	let chosen = $state<'a' | 'b' | null>(null);
	let saving = $state(false);
	let saveError = $state('');
	let showReveal = $state(false);
	let revealArchetype = $state<Archetype | null>(null);

	// When quest completes, compute archetype and trigger reveal
	$effect(() => {
		if (engine.isComplete && !showReveal && !revealArchetype) {
			const archetype = computeArchetype(engine.choices);
			revealArchetype = archetype;
			setTimeout(() => {
				showReveal = true;
			}, 300);
		}
	});

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
				choices
			});

			// Clear sessionStorage on successful save
			try {
				sessionStorage.removeItem(QUEST_STORAGE_KEY);
			} catch {
				// Ignore
			}

			if (spaceIds.length > 0) {
				goto(`/forge/${spaceIds[0]}`);
			} else {
				goto('/');
			}
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save quest. Please try again.';
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
				class="shimmer-bar h-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500 ease-out"
				style="width: {engine.progress * 100}%"
			></div>
		</div>
	</div>

	<!-- Top-left exit link (visible during quiz) -->
	{#if !engine.isComplete}
		<a
			href="/"
			class="fixed top-4 left-4 z-40 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-slate-200"
		>
			<ChevronLeft class="h-3 w-3" />
			Exit
		</a>
	{/if}

	{#if !engine.isComplete}
		<!-- Quest step -->
		{#key engine.currentStep}
			<div
				class="flex flex-1 flex-col items-center justify-center px-4 py-16"
				in:fly={{ y: 40, duration: 400 }}
			>
				<!-- Category badge -->
				<div
					class="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5"
				>
					<Sparkles class="h-3.5 w-3.5 text-purple-400" />
					<span class="text-xs font-semibold tracking-wide text-purple-300 uppercase">
						{engine.step?.category}
					</span>
				</div>

				<!-- Step counter -->
				<p class="mb-2 text-sm text-slate-400">
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
							{chosen === 'a'
							? 'scale-105 ring-2 ring-purple-400'
							: chosen === 'b'
								? 'scale-95 opacity-40'
								: 'hover:scale-[1.02]'}"
					>
						<div class="aspect-[4/3] w-full">
							<img
								src={engine.step?.optionA.image}
								alt={engine.step?.optionA.name}
								class="h-full w-full object-cover"
							/>
						</div>
						<div
							class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12"
						>
							<span class="text-lg font-semibold">{engine.step?.optionA.name}</span>
						</div>
					</button>

					<!-- Option B -->
					<button
						onclick={() => pick('b')}
						class="group relative overflow-hidden rounded-2xl transition-transform duration-300 focus:outline-none
							{chosen === 'b'
							? 'scale-105 ring-2 ring-purple-400'
							: chosen === 'a'
								? 'scale-95 opacity-40'
								: 'hover:scale-[1.02]'}"
					>
						<div class="aspect-[4/3] w-full">
							<img
								src={engine.step?.optionB.image}
								alt={engine.step?.optionB.name}
								class="h-full w-full object-cover"
							/>
						</div>
						<div
							class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12"
						>
							<span class="text-lg font-semibold">{engine.step?.optionB.name}</span>
						</div>
					</button>
				</div>
			</div>
		{/key}
	{:else}
		<!-- Results summary (behind the modal) -->
		<div
			class="flex flex-1 flex-col items-center justify-center px-4 py-16"
			in:scale={{ duration: 500, start: 0.9 }}
		>
			<div
				class="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5"
			>
				<Sparkles class="h-3.5 w-3.5 text-emerald-400" />
				<span class="text-xs font-semibold tracking-wide text-emerald-300 uppercase"
					>Quest Complete</span
				>
			</div>

			<h1 class="mb-2 text-center text-3xl font-bold sm:text-4xl">Your Workspace DNA</h1>
			<p class="mb-8 max-w-md text-center text-slate-400">
				These are the spaces that define your ideal workspace. Customize each one in the forge.
			</p>

			<!-- Results grid -->
			<div class="mb-10 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
									<span
										class="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300"
									>
										{tag}
									</span>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- CTA -->
			{#if saveError}
				<div class="mb-3 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
					{saveError}
				</div>
			{/if}
			<button
				onclick={finish}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500 disabled:opacity-50 disabled:hover:scale-100"
			>
				{#if saving}
					Saving...
				{:else}
					Enter the Forge
					<ArrowRight class="h-5 w-5" />
				{/if}
			</button>
		</div>
	{/if}

	<!-- Back to home link -->
	<div class="pb-6 text-center">
		<a
			href="/"
			class="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-300"
		>
			<ChevronRight class="h-3 w-3 rotate-180" />
			Back to home
		</a>
	</div>
</div>

<!-- Personality Reveal Modal -->
<CinematicModal open={showReveal} onclose={() => (showReveal = false)}>
	{#if revealArchetype}
		<!-- Stagger-animated content -->
		<div
			class="reveal-icon mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/20"
		>
			<Fingerprint class="h-10 w-10 text-purple-300" />
		</div>

		<p
			class="reveal-subtitle mb-1 text-sm font-medium tracking-widest text-purple-400/80 uppercase"
		>
			You are...
		</p>

		<h2 class="reveal-name mb-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
			{revealArchetype.name}
		</h2>

		<p class="reveal-description mb-8 max-w-sm text-lg leading-relaxed text-slate-300">
			{revealArchetype.description}
		</p>

		<!-- Space thumbnails -->
		<div class="reveal-spaces mb-8 flex gap-3">
			{#each engine.results as result, i (result.stepId)}
				<div
					class="reveal-space-thumb h-16 w-16 overflow-hidden rounded-lg border border-white/10"
					style="animation-delay: {i * 80}ms"
				>
					<img src={result.imageUrl} alt={result.spaceName} class="h-full w-full object-cover" />
				</div>
			{/each}
		</div>

		<!-- CTA -->
		<button
			onclick={() => {
				showReveal = false;
				finish();
			}}
			disabled={saving}
			class="reveal-cta pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500 disabled:opacity-50"
		>
			{#if saving}
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				Saving...
			{:else}
				Enter the Forge
				<ArrowRight class="h-5 w-5" />
			{/if}
		</button>
	{/if}
</CinematicModal>

<style>
	/* Shimmer effect on progress bar */
	.shimmer-bar {
		position: relative;
		overflow: hidden;
	}
	.shimmer-bar::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.15) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	/* Staggered reveal animations */
	.reveal-icon {
		animation: revealScale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		animation-delay: 200ms;
	}

	.reveal-subtitle {
		animation: revealFade 400ms ease-out both;
		animation-delay: 500ms;
	}

	.reveal-name {
		animation: revealFade 500ms ease-out both;
		animation-delay: 700ms;
	}

	.reveal-description {
		animation: revealFade 400ms ease-out both;
		animation-delay: 1000ms;
	}

	.reveal-spaces {
		animation: revealFade 400ms ease-out both;
		animation-delay: 1200ms;
	}

	.reveal-space-thumb {
		animation: revealScale 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		animation-delay: calc(1300ms + var(--thumb-delay, 0ms));
	}

	.reveal-space-thumb:nth-child(1) {
		--thumb-delay: 0ms;
	}
	.reveal-space-thumb:nth-child(2) {
		--thumb-delay: 80ms;
	}
	.reveal-space-thumb:nth-child(3) {
		--thumb-delay: 160ms;
	}
	.reveal-space-thumb:nth-child(4) {
		--thumb-delay: 240ms;
	}
	.reveal-space-thumb:nth-child(5) {
		--thumb-delay: 320ms;
	}

	.reveal-cta {
		animation: revealFade 400ms ease-out both;
		animation-delay: 1800ms;
	}

	@keyframes revealScale {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes revealFade {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
