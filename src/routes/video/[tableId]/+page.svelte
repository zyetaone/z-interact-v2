<script lang="ts">
	import { base } from '$app/paths';
	import { Film, Download, Play, Loader2, X, ChevronLeft } from '@lucide/svelte';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import type { Version } from '$lib/types/workspace';

	let { data } = $props();

	const ws = $derived(data.workspace);
	const history = $derived(data.history);
	const tableId = $derived(data.tableId);

	// Cinematic camera prompts that cycle through versions
	const CAMERA_MOVES = [
		'[Slow zoom in] Architectural workspace reveal, dramatic lighting, cinematic depth of field',
		'[Push in] Design transformation, smooth camera push, professional atmosphere',
		'[Pan left] Workspace evolution, golden hour lighting, editorial quality',
		'[Tracking shot] Interior design showcase, steady cam, magazine aesthetic',
		'[Pedestal up] Elegant office space, rising perspective, architectural beauty'
	];

	// Video generation state
	let isGenerating = $state(false);
	let currentScene = $state(0);
	let totalScenes = $state(0);
	let currentLabel = $state('');
	let videoClips = $state<Array<{ step: number; videoUrl: string; imageUrl: string; prompt: string }>>([]);
	let videoError = $state('');
	let activeClipIndex = $state<number | null>(null);
	let fullscreenClip = $state<string | null>(null);

	// Build the storyboard from history — each version is a scene
	const storyboard = $derived(
		history.map((v: Version, i: number) => ({
			...v,
			cameraMove: CAMERA_MOVES[i % CAMERA_MOVES.length],
			sceneNumber: i + 1
		}))
	);

	const canGenerate = $derived(storyboard.length >= 1 && !isGenerating);
	const hasClips = $derived(videoClips.length > 0);
	const progressPercent = $derived(totalScenes > 0 ? (currentScene / totalScenes) * 100 : 0);

	async function generateFilm() {
		if (!canGenerate) return;

		isGenerating = true;
		videoError = '';
		videoClips = [];
		currentScene = 0;
		totalScenes = storyboard.length;

		for (let i = 0; i < storyboard.length; i++) {
			const scene = storyboard[i];
			currentScene = i;
			currentLabel = `Scene ${i + 1}: ${scene.cameraMove.split(']')[0].replace('[', '')}`;

			try {
				const res = await fetch('/api/video', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						imageUrl: scene.imageUrl,
						index: i
					})
				});

				if (!res.ok) {
					continue;
				}

				const { videoUrl } = await res.json();
				videoClips = [
					...videoClips,
					{
						step: scene.step,
						videoUrl,
						imageUrl: scene.imageUrl,
						prompt: scene.prompt
					}
				];
			} catch {
				continue;
			}
		}

		currentScene = totalScenes;
		currentLabel = '';
		isGenerating = false;

		if (videoClips.length === 0) {
			videoError = 'All video generations failed. Check your FAL_API_KEY configuration.';
		}
	}

	async function downloadClip(videoUrl: string, step: number) {
		try {
			const res = await fetch(videoUrl);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `table-${tableId}-scene-${step}.mp4`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			videoError = 'Download failed — try right-clicking the video instead';
		}
	}

	async function downloadAll() {
		for (const clip of videoClips) {
			await downloadClip(clip.videoUrl, clip.step);
		}
	}

	function openFullscreen(videoUrl: string) {
		fullscreenClip = videoUrl;
	}

	function closeFullscreen() {
		fullscreenClip = null;
	}
</script>

<svelte:head>
	<title>Table {tableId} — Creative Journey</title>
</svelte:head>

<div class="fade-in relative min-h-screen overflow-hidden">
	<!-- Cinematic Background -->
	<div class="fixed inset-0 -z-10">
		<div
			class="absolute inset-0 scale-110 opacity-20 blur-3xl saturate-50"
			style="background-image: url('{ws.currentImageUrl}'); background-size: cover; background-position: center;"
		></div>
		<div class="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/95"></div>
		<!-- Film grain overlay -->
		<div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');"></div>
		<!-- Vignette -->
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]"></div>
	</div>

	<!-- Navigation -->
	<nav class="slide-up relative z-20 flex items-center justify-between px-6 py-5 sm:px-8">
		<a
			href="{base}/table/{tableId}"
			class="glass smooth-transition flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-300 hover:scale-105 hover:text-white"
		>
			<ChevronLeft class="h-4 w-4" />
			<span>Back to Editor</span>
		</a>

		{#if hasClips && !isGenerating}
			<button
				onclick={downloadAll}
				class="glass smooth-transition flex items-center gap-2 rounded-full px-4 py-2 text-sm text-emerald-300 hover:scale-105 hover:bg-emerald-500/10 hover:text-emerald-200"
			>
				<Download class="h-4 w-4" />
				<span>Download Reel</span>
			</button>
		{/if}
	</nav>

	<!-- Hero Section -->
	<header class="relative z-10 px-6 pb-8 pt-4 text-center sm:px-8 sm:pb-12 sm:pt-8">
		<div class="slide-up mx-auto max-w-3xl">
			<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-xs font-medium tracking-widest text-purple-300 uppercase">
				<Film class="h-3.5 w-3.5" />
				Creative Journey
			</div>
			<h1 class="mb-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
				Table {tableId}
			</h1>
			<p class="mx-auto max-w-lg text-sm text-slate-400 sm:text-base">
				{storyboard.length} scene{storyboard.length !== 1 ? 's' : ''} of design evolution — from first stroke to final vision
			</p>
		</div>
	</header>

	<!-- Storyboard Timeline -->
	{#if storyboard.length > 0}
		<section class="relative z-10 px-6 pb-8 sm:px-8">
			<div class="mx-auto max-w-5xl">
				<h2 class="text-subheading mb-4">Storyboard</h2>
				<div class="flex gap-3 overflow-x-auto pb-3">
					{#each storyboard as scene, i (scene.id)}
						<div
							class="zoom-in group flex w-36 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm transition-all hover:border-purple-500/30 hover:bg-white/10 sm:w-44"
							style="animation-delay: {i * 80}ms"
						>
							<div class="relative aspect-square overflow-hidden">
								<img
									src={scene.imageUrl}
									alt="Scene {scene.sceneNumber}"
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
								/>
								<div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
								<div class="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/80 text-[10px] font-bold text-white">
									{scene.sceneNumber}
								</div>
							</div>
							<div class="p-2.5">
								<p class="mb-1 text-[10px] font-medium text-purple-300/80">
									{scene.cameraMove.split(']')[0].replace('[', '')}
								</p>
								<p class="line-clamp-2 text-[11px] leading-snug text-slate-400">
									{scene.prompt}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<!-- Generate Film Button -->
	{#if !hasClips}
		<section class="relative z-10 px-6 pb-10 sm:px-8">
			<div class="mx-auto max-w-2xl text-center">
				{#if isGenerating}
					<!-- Generation Progress -->
					<div class="glass slide-up rounded-2xl p-8">
						<div class="mb-5 flex justify-center">
							<div class="relative">
								<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20">
									<Loader2 class="h-8 w-8 animate-spin text-purple-400" />
								</div>
								<div class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
									{currentScene + 1}
								</div>
							</div>
						</div>
						<h3 class="mb-1 text-lg font-semibold text-white">Creating Your Film</h3>
						<p class="mb-5 text-sm text-slate-400">{currentLabel}</p>

						<div class="mx-auto max-w-sm">
							<div class="mb-2 flex justify-between text-xs text-slate-500">
								<span>Scene {currentScene + 1} of {totalScenes}</span>
								<span>{Math.round(progressPercent)}%</span>
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
								<div
									class="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-700 ease-out"
									style="width: {progressPercent}%"
								></div>
							</div>
						</div>
					</div>
				{:else}
					<button
						onclick={generateFilm}
						disabled={!canGenerate}
						class="glass smooth-transition group inline-flex items-center gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-8 py-4 text-lg font-semibold text-purple-200 hover:scale-105 hover:border-purple-500/50 hover:bg-purple-500/20 hover:text-white hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Film class="h-5 w-5 transition-transform group-hover:rotate-12" />
						Generate Film
					</button>
					<p class="mt-3 text-xs text-slate-500">
						Each scene will be transformed into a cinematic video clip
					</p>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Error -->
	{#if videoError}
		<div class="relative z-10 px-6 pb-6 sm:px-8">
			<div class="mx-auto max-w-2xl">
				<div class="flex items-center gap-3 rounded-xl bg-rose-500/10 px-5 py-3 text-sm text-rose-300">
					<X class="h-4 w-4 flex-shrink-0" />
					<span>{videoError}</span>
					<button onclick={() => (videoError = '')} class="ml-auto text-rose-400 hover:text-rose-200">
						<X class="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Film Strip — Generated Clips -->
	{#if hasClips}
		<section class="relative z-10 px-6 pb-12 sm:px-8">
			<div class="mx-auto max-w-6xl">
				<div class="mb-5 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
							<Film class="h-5 w-5 text-purple-300" />
						</div>
						<div>
							<h2 class="text-sm font-semibold text-white">Film Reel</h2>
							<p class="text-xs text-slate-400">
								{videoClips.length} clip{videoClips.length !== 1 ? 's' : ''} ready
								{#if isGenerating}
									— generating more...
								{/if}
							</p>
						</div>
					</div>
				</div>

				<!-- Horizontal film strip -->
				<div class="flex gap-4 overflow-x-auto pb-4">
					{#each videoClips as clip, i (clip.step)}
						<div
							class="zoom-in group relative w-72 flex-shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-black/40 backdrop-blur-sm transition-all hover:border-purple-500/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] sm:w-80"
							style="animation-delay: {i * 100}ms"
						>
							<!-- Video -->
							<div class="relative aspect-video overflow-hidden">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video
									src={clip.videoUrl}
									class="h-full w-full object-cover"
									loop
									muted
									playsinline
									onmouseenter={(e) => {
										e.currentTarget.play();
										activeClipIndex = i;
									}}
									onmouseleave={(e) => {
										e.currentTarget.pause();
										e.currentTarget.currentTime = 0;
										activeClipIndex = null;
									}}
								></video>

								<!-- Play overlay (hidden on hover) -->
								<div
									class="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity {activeClipIndex === i ? 'opacity-0' : 'opacity-100'}"
								>
									<div class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
										<Play class="h-5 w-5 text-white" />
									</div>
								</div>

								<!-- Scene badge -->
								<div class="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
									Scene {i + 1}
								</div>

								<!-- Action buttons -->
								<div class="absolute right-2 bottom-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
									<button
										onclick={() => openFullscreen(clip.videoUrl)}
										class="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-purple-500/60"
										title="Play fullscreen"
									>
										<Play class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => downloadClip(clip.videoUrl, clip.step)}
										class="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-emerald-500/60"
										title="Download clip"
									>
										<Download class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>

							<!-- Caption -->
							<div class="p-3">
								<p class="line-clamp-1 text-xs text-slate-400">{clip.prompt}</p>
							</div>
						</div>
					{/each}
				</div>

				<!-- Regenerate CTA -->
				{#if !isGenerating}
					<div class="mt-6 text-center">
						<button
							onclick={generateFilm}
							class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
						>
							<Film class="h-3.5 w-3.5" />
							Regenerate Film
						</button>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Progress during generation (inline with clips) -->
	{#if isGenerating && hasClips}
		<section class="relative z-10 px-6 pb-8 sm:px-8">
			<div class="mx-auto max-w-2xl">
				<div class="glass rounded-xl p-4">
					<div class="flex items-center gap-3">
						<Loader2 class="h-4 w-4 flex-shrink-0 animate-spin text-purple-400" />
						<div class="min-w-0 flex-1">
							<p class="text-sm text-white">{currentLabel}</p>
							<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
								<div
									class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700 ease-out"
									style="width: {progressPercent}%"
								></div>
							</div>
						</div>
						<span class="text-xs text-slate-500">{currentScene + 1}/{totalScenes}</span>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- Empty state -->
	{#if storyboard.length === 0}
		<section class="relative z-10 px-6 pb-12 sm:px-8">
			<div class="mx-auto max-w-md text-center">
				<div class="glass rounded-2xl p-10">
					<div class="mb-4 flex justify-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20">
							<Film class="h-8 w-8 text-purple-300" />
						</div>
					</div>
					<h2 class="mb-2 text-lg font-semibold text-white">No Scenes Yet</h2>
					<p class="mb-5 text-sm text-slate-400">
						Make some edits to your workspace first, then come back to create your creative journey film.
					</p>
					<a
						href="{base}/table/{tableId}"
						class="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-500"
					>
						<ChevronLeft class="h-4 w-4" />
						Back to Editor
					</a>
				</div>
			</div>
		</section>
	{/if}
</div>

<!-- Layer Navigation -->
<LayerBar
	activeLayer="video"
	tableId={tableId}
	layers={{
		canvas: { available: true },
		world: { available: true },
		video: { available: true }
	}}
	class="fixed bottom-6 left-1/2 z-20 -translate-x-1/2"
/>

<!-- Fullscreen Video Modal -->
{#if fullscreenClip}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
		onclick={closeFullscreen}
		onkeydown={(e) => e.key === 'Escape' && closeFullscreen()}
		role="dialog"
		aria-modal="true"
		aria-label="Fullscreen video"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={fullscreenClip}
			class="max-h-[90vh] max-w-[90vw] rounded-xl"
			controls
			autoplay
			loop
			onclick={(e) => e.stopPropagation()}
		></video>
		<button
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
			onclick={closeFullscreen}
			aria-label="Close fullscreen"
		>
			<X class="h-5 w-5" />
		</button>
	</div>
{/if}
