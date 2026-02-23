<script lang="ts">
	import { base } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { TABLE_COUNT } from '$lib/config/tables';
	import type { Workspace } from '$lib/server/db/schema';
	import { Film, Download, Loader2, X, Globe } from '@lucide/svelte';

	let { data } = $props();

	// Snapshot SSR data for local mutation via polling (untrack prevents reactivity warnings)
	let workspaces = $state(untrack(() => data.workspaces));

	// Video generation state
	let isGenerating = $state(false);
	let videoProgress = $state(0);
	let videoTotal = $state(0);
	let videoCurrentTable = $state<number | null>(null);
	let videoClips = $state<Array<{ tableId: number; videoUrl: string }>>([]);
	let videoError = $state('');
	let showVideoPanel = $state(false);

	const canGenerateVideo = $derived(workspaces.length >= 2 && !isGenerating);

	onMount(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch('/api/poll');
				if (!res.ok) return;
				const { workspaces: all } = (await res.json()) as { workspaces: Workspace[] };
				workspaces = all.filter((w) => w.status === 'locked' && w.currentImageUrl);
				if (workspaces.length >= TABLE_COUNT) clearInterval(interval);
			} catch {
				// Network error — skip this poll cycle
			}
		}, 5000);
		return () => clearInterval(interval);
	});

	async function generateShowreel() {
		if (isGenerating || workspaces.length < 2) return;

		isGenerating = true;
		videoError = '';
		videoClips = [];
		videoProgress = 0;
		videoTotal = workspaces.length;
		showVideoPanel = true;

		const sorted = [...workspaces].sort((a, b) => a.tableId - b.tableId);

		for (let i = 0; i < sorted.length; i++) {
			const ws = sorted[i];
			videoCurrentTable = ws.tableId;
			videoProgress = i;

			try {
				const res = await fetch('/api/video', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						imageUrl: ws.currentImageUrl,
						index: i
					})
				});

				if (!res.ok) {
					const err = await res.json().catch(() => ({ message: 'Unknown error' }));
					console.error(`Video failed for table ${ws.tableId}:`, err);
					continue; // Skip failed clips, continue with others
				}

				const { videoUrl } = await res.json();
				videoClips = [...videoClips, { tableId: ws.tableId, videoUrl }];
			} catch (e) {
				console.error(`Video failed for table ${ws.tableId}:`, e);
				continue;
			}
		}

		videoProgress = videoTotal;
		videoCurrentTable = null;
		isGenerating = false;

		if (videoClips.length === 0) {
			videoError = 'All video generations failed. Check your FAL_API_KEY.';
		}
	}

	async function downloadClip(videoUrl: string, tableId: number) {
		try {
			const res = await fetch(videoUrl);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `workspace-table-${tableId}.mp4`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			videoError = 'Download failed — try right-clicking the video instead';
		}
	}

	async function downloadAll() {
		for (const clip of videoClips) {
			await downloadClip(clip.videoUrl, clip.tableId);
		}
	}
</script>

<svelte:head>
	<title>Gallery — Workspace Studio</title>
</svelte:head>

<div class="fade-in mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
	<header class="glass slide-up mb-6 rounded-2xl px-6 py-5">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-bold text-white">Gallery</h1>
				<p class="text-xs text-slate-400">
					{workspaces.length} submitted design{workspaces.length !== 1 ? 's' : ''}
				</p>
			</div>

			<div class="flex items-center gap-2">
				{#if workspaces.length >= 1}
					<a
						href="{base}/world"
						class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white"
					>
						<Globe class="h-4 w-4" />
						<span class="hidden sm:inline">3D World</span>
					</a>
				{/if}
				{#if workspaces.length >= 2}
					<button
						onclick={generateShowreel}
						disabled={!canGenerateVideo}
						class="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-300 transition-all hover:bg-purple-500/20 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isGenerating}
							<Loader2 class="h-4 w-4 animate-spin" />
							<span>Generating {videoProgress}/{videoTotal}...</span>
						{:else}
							<Film class="h-4 w-4" />
							<span>Create Showreel</span>
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</header>

	{#if workspaces.length === 0}
		<div class="glass flex min-h-[300px] flex-col items-center justify-center rounded-2xl p-12">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20">
				<svg class="h-8 w-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h2 class="mb-1 text-lg font-semibold text-white">No Designs Yet</h2>
			<p class="text-sm text-slate-400">Submitted workspace designs will appear here</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
			{#each workspaces as ws (ws.tableId)}
				<a
					href="{base}/gallery/{ws.tableId}"
					class="glass zoom-in group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/5 transition-all duration-300 hover:scale-[1.03] hover:ring-white/20"
				>
					<img
						src={ws.currentImageUrl}
						alt="Table {ws.tableId} design"
						class="image-loaded h-full w-full object-cover"
					/>
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-80"
					></div>
					<div
						class="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm"
					>
						Table {ws.tableId}
					</div>
					{#if ws.editCount > 0}
						<div
							class="absolute right-2 bottom-2 rounded-full bg-purple-500/80 px-2 py-0.5 text-[10px] font-medium text-white"
						>
							{ws.editCount} edit{ws.editCount !== 1 ? 's' : ''}
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Video Generation Panel -->
	{#if showVideoPanel}
		<div class="glass slide-up mt-6 rounded-2xl p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
						<Film class="h-5 w-5 text-purple-300" />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-white">Showreel</h3>
						<p class="text-xs text-slate-400">
							{#if isGenerating}
								Generating clip for Table {videoCurrentTable}...
							{:else if videoClips.length > 0}
								{videoClips.length} clip{videoClips.length !== 1 ? 's' : ''} ready
							{:else}
								No clips generated
							{/if}
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if videoClips.length > 1 && !isGenerating}
						<button
							onclick={downloadAll}
							class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
						>
							<Download class="h-3.5 w-3.5" />
							Download All
						</button>
					{/if}
					{#if !isGenerating}
						<button
							onclick={() => (showVideoPanel = false)}
							class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			{#if isGenerating}
				<div class="mb-4">
					<div class="mb-1 flex justify-between text-xs text-slate-400">
						<span>Processing...</span>
						<span>{videoProgress}/{videoTotal}</span>
					</div>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
						<div
							class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700 ease-out"
							style="width: {(videoProgress / videoTotal) * 100}%"
						></div>
					</div>
				</div>
			{/if}

			<!-- Error -->
			{#if videoError}
				<div class="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
					{videoError}
				</div>
			{/if}

			<!-- Video clips grid -->
			{#if videoClips.length > 0}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each videoClips as clip (clip.tableId)}
						<div class="group relative overflow-hidden rounded-xl bg-black">
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={clip.videoUrl}
								class="aspect-video w-full object-cover"
								loop
								muted
								playsinline
								onmouseenter={(e) => e.currentTarget.play()}
								onmouseleave={(e) => {
									e.currentTarget.pause();
									e.currentTarget.currentTime = 0;
								}}
							></video>
							<div class="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
								Table {clip.tableId}
							</div>
							<button
								onclick={() => downloadClip(clip.videoUrl, clip.tableId)}
								class="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
								title="Download clip"
							>
								<Download class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
