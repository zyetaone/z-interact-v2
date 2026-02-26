<script lang="ts">
	import { Film, Play, Upload, Loader2, Check, X, ChevronLeft, ChevronRight } from '@lucide/svelte'
	import { SvelteSet } from 'svelte/reactivity'

	interface ImageItem {
		id: string
		url: string
		name: string
	}

	interface Props {
		images: ImageItem[]
		ongenerate?: (selectedImages: ImageItem[]) => void
		class?: string
	}

	let { images, ongenerate, class: className = '' }: Props = $props()

	// Selection state — SvelteSet is inherently reactive, no $state wrapper needed
	let selectedIds = new SvelteSet<string>()
	let isGenerating = $state(false)
	let generatedVideoUrl = $state<string | null>(null)
	let activeFilmFrame = $state(0)
	let errorMessage = $state('')

	// Derived
	const selectedImages = $derived(images.filter((img) => selectedIds.has(img.id)))
	const hasSelection = $derived(selectedIds.size > 0)
	const allSelected = $derived(selectedIds.size === images.length && images.length > 0)
	const canGenerate = $derived(hasSelection && !isGenerating)

	function toggleSelect(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id)
		} else {
			selectedIds.add(id)
		}
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds.clear()
		} else {
			selectedIds.clear()
			images.forEach((img) => selectedIds.add(img.id))
		}
	}

	function clearSelection() {
		selectedIds.clear()
	}

	async function handleGenerate() {
		if (!canGenerate) return
		errorMessage = ''
		isGenerating = true

		try {
			if (ongenerate) {
				ongenerate(selectedImages)
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to start generation'
		}
		// isGenerating stays true until consumer resolves (they call setVideo or reset)
	}

	// Public API for consumer to resolve the generating state
	export function setGeneratedVideo(url: string) {
		generatedVideoUrl = url
		isGenerating = false
		activeFilmFrame = 0
	}

	export function setError(message: string) {
		errorMessage = message
		isGenerating = false
	}

	export function reset() {
		generatedVideoUrl = null
		isGenerating = false
		selectedIds.clear()
		errorMessage = ''
		activeFilmFrame = 0
	}

	function prevFrame() {
		if (activeFilmFrame > 0) activeFilmFrame--
	}

	function nextFrame() {
		if (activeFilmFrame < selectedImages.length - 1) activeFilmFrame++
	}
</script>

<div class="flex flex-col gap-6 {className}">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10"
			>
				<Film class="h-5 w-5 text-amber-400" />
			</div>
			<div>
				<h2 class="text-base font-semibold text-white">Video Studio</h2>
				<p class="text-xs text-slate-400">
					{images.length} image{images.length !== 1 ? 's' : ''} available
				</p>
			</div>
		</div>

		{#if hasSelection}
			<div class="flex items-center gap-2">
				<span class="text-xs text-slate-400">
					{selectedIds.size} selected
				</span>
				<button
					onclick={clearSelection}
					class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
					aria-label="Clear selection"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		{/if}
	</div>

	<!-- Storyboard Grid -->
	{#if images.length > 0}
		<div class="flex flex-col gap-3">
			<!-- Select All -->
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Storyboard</span>
				<button
					onclick={toggleSelectAll}
					class="text-xs text-amber-400 transition-colors hover:text-amber-300"
				>
					{allSelected ? 'Deselect All' : 'Select All'}
				</button>
			</div>

			<!-- Grid -->
			<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
				{#each images as image (image.id)}
					{@const isSelected = selectedIds.has(image.id)}
					<button
						onclick={() => toggleSelect(image.id)}
						class="group relative aspect-square overflow-hidden rounded-lg border-2 transition-all duration-150
							{isSelected
							? 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
							: 'border-white/10 hover:border-white/25 hover:shadow-[0_0_8px_rgba(255,255,255,0.05)]'}"
						aria-label="Select {image.name}"
						aria-pressed={isSelected}
					>
						<img
							src={image.url}
							alt={image.name}
							class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
						/>

						<!-- Overlay on hover/selected -->
						<div
							class="absolute inset-0 transition-opacity duration-150
								{isSelected ? 'bg-amber-500/20 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}"
						></div>

						<!-- Check badge -->
						{#if isSelected}
							<div
								class="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-md"
							>
								<Check class="h-3 w-3 text-white" />
							</div>
						{/if}

						<!-- Name tooltip -->
						<div
							class="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
						>
							<p class="truncate text-[10px] text-white/90">{image.name}</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Empty state -->
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-12"
		>
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5"
			>
				<Upload class="h-5 w-5 text-slate-500" />
			</div>
			<div class="text-center">
				<p class="text-sm font-medium text-slate-400">No images yet</p>
				<p class="mt-0.5 text-xs text-slate-600">Complete some spaces in Forge to get started</p>
			</div>
		</div>
	{/if}

	<!-- Generate Button -->
	{#if images.length > 0}
		<div class="flex flex-col gap-2">
			<button
				onclick={handleGenerate}
				disabled={!canGenerate}
				class="flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all duration-150
					{canGenerate
					? 'bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-400 hover:shadow-[0_0_28px_rgba(245,158,11,0.45)] active:scale-[0.98]'
					: 'cursor-not-allowed bg-white/5 text-slate-600'}"
				aria-busy={isGenerating}
			>
				{#if isGenerating}
					<Loader2 class="h-4 w-4 animate-spin" />
					Generating...
				{:else}
					<Play class="h-4 w-4 fill-current" />
					Generate Video
					{#if hasSelection}
						<span
							class="ml-1 rounded-full bg-amber-600/40 px-1.5 py-0.5 text-xs font-medium tabular-nums"
						>
							{selectedIds.size}
						</span>
					{/if}
				{/if}
			</button>

			{#if !hasSelection && images.length > 0}
				<p class="text-center text-xs text-slate-500">Select images above to create a video</p>
			{/if}
		</div>
	{/if}

	<!-- Error Message -->
	{#if errorMessage}
		<div
			class="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3"
		>
			<span class="text-sm text-rose-300">{errorMessage}</span>
			<button
				onclick={() => (errorMessage = '')}
				class="ml-auto flex-shrink-0 text-rose-400 hover:text-rose-200"
				aria-label="Dismiss error"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/if}

	<!-- Generating state indicator -->
	{#if isGenerating}
		<div class="glass-panel flex flex-col gap-4 rounded-xl p-5">
			<div class="flex items-center gap-3">
				<div class="relative h-8 w-8 flex-shrink-0">
					<div class="absolute inset-0 rounded-full border-2 border-amber-500/20"></div>
					<div
						class="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-500"
					></div>
				</div>
				<div>
					<p class="text-sm font-medium text-white">Building your video</p>
					<p class="text-xs text-slate-400">
						Stitching {selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''}...
					</p>
				</div>
			</div>

			<!-- Film strip preview of selected -->
			{#if selectedImages.length > 0}
				<div class="flex gap-1.5 overflow-x-auto pb-1">
					{#each selectedImages as img, i (img.id)}
						<div
							class="relative flex-shrink-0 overflow-hidden rounded-md border transition-all duration-150
								{i === activeFilmFrame ? 'border-amber-500' : 'border-white/10'}"
						>
							<img src={img.url} alt={img.name} class="h-14 w-14 object-cover" />
							<div
								class="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center font-mono text-[8px] text-white/60"
							>
								{i + 1}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Generated Video Player -->
	{#if generatedVideoUrl}
		<div class="glass-panel flex flex-col gap-4 rounded-xl p-5">
			<!-- Video header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Film class="h-4 w-4 text-amber-400" />
					<span class="text-sm font-medium text-white">Generated Video</span>
				</div>
				<button
					onclick={reset}
					class="text-xs text-slate-400 transition-colors hover:text-white"
				>
					Start over
				</button>
			</div>

			<!-- Video element -->
			<div class="overflow-hidden rounded-lg border border-white/10 bg-black">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					src={generatedVideoUrl}
					controls
					autoplay
					loop
					class="w-full"
					aria-label="Generated video"
				></video>
			</div>

			<!-- Film strip navigator -->
			{#if selectedImages.length > 0}
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs text-slate-500">Source frames</span>
						<div class="flex items-center gap-1">
							<button
								onclick={prevFrame}
								disabled={activeFilmFrame === 0}
								class="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
								aria-label="Previous frame"
							>
								<ChevronLeft class="h-3.5 w-3.5" />
							</button>
							<span class="min-w-[3rem] text-center font-mono text-xs text-slate-400">
								{activeFilmFrame + 1} / {selectedImages.length}
							</span>
							<button
								onclick={nextFrame}
								disabled={activeFilmFrame === selectedImages.length - 1}
								class="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
								aria-label="Next frame"
							>
								<ChevronRight class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					<div class="flex gap-1.5 overflow-x-auto pb-1">
						{#each selectedImages as img, i (img.id)}
							<button
								onclick={() => (activeFilmFrame = i)}
								class="relative flex-shrink-0 overflow-hidden rounded-md border-2 transition-all duration-150
									{i === activeFilmFrame
									? 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
									: 'border-white/10 hover:border-white/25'}"
								aria-label="Frame {i + 1}: {img.name}"
								aria-pressed={i === activeFilmFrame}
							>
								<img src={img.url} alt={img.name} class="h-14 w-14 object-cover" />
								<div
									class="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center font-mono text-[8px] text-white/60"
								>
									{i + 1}
								</div>
							</button>
						{/each}
					</div>

					<!-- Active frame preview -->
					{#if selectedImages[activeFilmFrame]}
						<div class="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2">
							<img
								src={selectedImages[activeFilmFrame].url}
								alt={selectedImages[activeFilmFrame].name}
								class="h-12 w-12 flex-shrink-0 rounded-md object-cover"
							/>
							<div class="min-w-0">
								<p class="truncate text-xs font-medium text-slate-300">
									{selectedImages[activeFilmFrame].name}
								</p>
								<p class="text-[10px] text-slate-500">Frame {activeFilmFrame + 1}</p>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
