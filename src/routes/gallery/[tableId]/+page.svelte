<script lang="ts">
	import { base } from '$app/paths';
	import { downloadImage } from '$lib/utils/download';

	let { data } = $props();

	const ws = $derived(data.workspace);
	const history = $derived(data.history);
	const tableId = $derived(data.tableId);

	let showFullscreen = $state(false);

	function handleDownload() {
		downloadImage(ws.currentImageUrl, `workspace-table-${tableId}.png`);
	}

	function toggleFullscreen() {
		showFullscreen = !showFullscreen;
	}
</script>

<svelte:head>
	<title>Table {tableId} — Gallery</title>
</svelte:head>

<div class="fade-in relative min-h-screen">
	<!-- Floating Back Button -->
	<a
		href="{base}/gallery"
		class="glass smooth-transition fixed top-6 left-6 z-50 flex h-10 w-10 items-center justify-center rounded-full hover:scale-110"
		aria-label="Back to Gallery"
	>
		<svg class="h-4 w-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
	</a>

	<!-- Hero Image Section -->
	<div class="relative min-h-[85vh] overflow-hidden">
		<!-- Background blur -->
		<div
			class="absolute inset-0 scale-110 opacity-40 blur-3xl"
			style="background-image: url('{ws.currentImageUrl}'); background-size: cover; background-position: center;"
		></div>

		<!-- Main Image -->
		<div class="relative z-10 flex min-h-[85vh] items-center justify-center p-6">
			<div class="glass max-h-[80vh] max-w-[80vh] overflow-hidden rounded-2xl p-1">
				<button class="block overflow-hidden rounded-xl" onclick={toggleFullscreen}>
					<img
						src={ws.currentImageUrl}
						alt="Workspace design for Table {tableId}"
						class="image-loaded aspect-square w-full object-cover"
					/>
				</button>
			</div>
		</div>

		<!-- Overlay Footer -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
		>
			<div class="slide-up pointer-events-auto mx-auto max-w-6xl px-8 pb-8">
				<div class="flex items-end justify-between">
					<div class="flex flex-wrap gap-2">
						<span
							class="rounded-lg bg-purple-500/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
						>
							Table {tableId}
						</span>
						{#if ws.editCount > 0}
							<span
								class="rounded-lg bg-blue-500/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
							>
								{ws.editCount} edit{ws.editCount !== 1 ? 's' : ''}
							</span>
						{/if}
						<span
							class="rounded-lg px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm {ws.status ===
							'locked'
								? 'bg-emerald-500/80'
								: 'bg-amber-500/80'}"
						>
							{ws.status === 'locked' ? 'Submitted' : 'In Progress'}
						</span>
					</div>

					<!-- Action Buttons -->
					<div class="flex gap-3">
						{#if ws.status !== 'locked'}
							<a
								href="{base}/table/{tableId}"
								class="glass smooth-transition flex h-10 w-10 items-center justify-center rounded-full text-white hover:scale-110"
								title="Edit"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</a>
						{/if}
						<button
							onclick={handleDownload}
							class="glass smooth-transition flex h-10 w-10 items-center justify-center rounded-full text-white hover:scale-110"
							title="Download"
							aria-label="Download image"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</button>
						<button
							onclick={toggleFullscreen}
							class="glass smooth-transition flex h-10 w-10 items-center justify-center rounded-full text-white hover:scale-110"
							title="Fullscreen"
							aria-label="View fullscreen"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Edit History Section -->
	{#if history.length > 0}
		<div class="mx-auto max-w-4xl px-6 py-8">
			<div class="glass slide-up rounded-2xl p-6">
				<h3 class="mb-4 text-lg font-semibold tracking-wider text-white uppercase">Edit History</h3>
				<div class="space-y-3">
					{#each history as edit, i (edit.id)}
						<div class="flex items-start gap-4 rounded-xl bg-white/5 p-4">
							<div class="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
								<img src={edit.imageUrl} alt="Edit {i + 1}" class="h-full w-full object-cover" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-slate-200">Step {edit.step}</p>
								<p class="truncate text-xs text-slate-400">{edit.prompt}</p>
							</div>
							<span class="shrink-0 text-[10px] text-slate-500">
								{new Date(edit.createdAt).toLocaleTimeString()}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Fullscreen Modal -->
{#if showFullscreen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		onclick={toggleFullscreen}
		onkeydown={(e) => e.key === 'Escape' && toggleFullscreen()}
		role="dialog"
		aria-modal="true"
		aria-label="Fullscreen image view"
		tabindex="-1"
	>
		<img
			src={ws.currentImageUrl}
			alt="Workspace design fullscreen"
			class="max-h-[95vh] max-w-[95vw] object-contain"
		/>
		<button
			class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
			onclick={toggleFullscreen}
			aria-label="Close fullscreen"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}
