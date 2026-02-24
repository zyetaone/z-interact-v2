<script lang="ts">
	import { ForgeWorkspace } from '../forge-workspace.svelte';
	import { Editor } from '$lib/editor.svelte';
	import VersionTree from '$lib/components/VersionTree.svelte';
	import EditorBar from '$lib/components/EditorBar.svelte';
	import CommandBar from '$lib/components/CommandBar.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { maskCanvas } from '$lib/actions/mask-canvas.svelte';
	import {
		PanelRightClose,
		PanelRightOpen,
		Square,
		Paintbrush,
		Wand2,
		Pentagon,
		ChevronsLeftRight,
		Sparkles,
		ArrowLeft,
		Box,
		ExternalLink
	} from '@lucide/svelte';
	import { generateMaskFromShapes } from '$lib/utils/mask';
	import { segmentObject } from '../ai.remote';

	let { data } = $props();

	let workspace = $state(new ForgeWorkspace({ space: data.space, history: data.history }));
	let editor = $state(new Editor());
	let commandBarRef: ReturnType<typeof CommandBar> | undefined = $state();
	let errorTimer: ReturnType<typeof setTimeout> | undefined;
	let magicClickPos = $state<{ x: number; y: number } | null>(null);

	// Viewer state (inline, replaces deleted viewer.svelte.ts)
	let imgRef = $state<HTMLImageElement | undefined>();
	let imgWidth = $state(0);
	let imgHeight = $state(0);
	let natWidth = $state(0);
	let natHeight = $state(0);
	let isMobile = $state(false);
	let isSidebarOpen = $state(true);
	let sheetSnap = $state<'collapsed' | 'peek' | 'full'>('peek');
	let compareSlider = $state(50);
	let isDraggingCompare = $state(false);

	const canvasWidth = $derived(imgWidth || 800);
	const canvasHeight = $derived(imgHeight || 600);
	const naturalWidth = $derived(natWidth || 1);
	const naturalHeight = $derived(natHeight || 1);

	const renderedFrame = $derived.by(() => {
		if (!imgRef || !imgWidth || !imgHeight || !natWidth || !natHeight) {
			return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
		}
		const containerAR = imgWidth / imgHeight;
		const imageAR = natWidth / natHeight;
		let rw: number, rh: number, rx: number, ry: number;
		if (imageAR > containerAR) {
			rw = imgWidth;
			rh = imgWidth / imageAR;
			rx = 0;
			ry = (imgHeight - rh) / 2;
		} else {
			rh = imgHeight;
			rw = imgHeight * imageAR;
			rx = (imgWidth - rw) / 2;
			ry = 0;
		}
		return {
			x: rx,
			y: ry,
			width: rw,
			height: rh,
			scale: natWidth / rw
		};
	});

	function setupMediaQuery(): () => void {
		if (typeof window === 'undefined') return () => {};
		const mql = window.matchMedia('(max-width: 767px)');
		const handler = (e: MediaQueryListEvent | MediaQueryList) => {
			isMobile = e.matches;
			if (isMobile) isSidebarOpen = false;
		};
		handler(mql);
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}

	// Auto-dismiss error messages after 5 seconds
	$effect(() => {
		if (workspace.errorMessage) {
			clearTimeout(errorTimer);
			errorTimer = setTimeout(() => (workspace.errorMessage = ''), 5000);
		}
		return () => clearTimeout(errorTimer);
	});

	// Setup mobile media query
	$effect(() => {
		return setupMediaQuery();
	});

	async function handleAssetUpload(file: File) {
		const formData = new FormData();
		formData.append('image', file);

		try {
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});
			if (!res.ok) throw new Error('Asset upload failed');

			const { url } = await res.json();
			editor.assetUrl = url;
		} catch (e) {
			workspace.errorMessage = e instanceof Error ? e.message : 'Asset upload failed';
		}
	}

	async function handleGenerate() {
		if (!editor.canGenerate) return;

		let maskData = editor.maskData;
		if (maskData && imgRef) {
			const maskUrl = generateMaskFromShapes(
				editor.rects,
				editor.paths,
				editor.polygons,
				naturalWidth,
				naturalHeight,
				renderedFrame
			);
			if (maskUrl) {
				maskData = { ...maskData, aiMaskUrl: maskUrl };
			}
		}

		await workspace.generate(editor.prompt, maskData, editor.mode, editor.strength);
		editor.prompt = '';
	}

	async function handleMagicClick(x: number, y: number) {
		if (workspace.isProcessing) return;

		const frame = renderedFrame;
		if (frame.scale > 0) {
			magicClickPos = {
				x: frame.x + x / frame.scale,
				y: frame.y + y / frame.scale
			};
		}

		workspace.isProcessing = true;
		try {
			const { maskUrl } = await segmentObject({
				imageUrl: workspace.currentImageUrl,
				points: [[x, y]]
			});
			editor.aiMaskUrl = maskUrl;
		} catch (e) {
			workspace.errorMessage = e instanceof Error ? e.message : 'Magic wand failed';
		} finally {
			workspace.isProcessing = false;
			magicClickPos = null;
		}
	}

	function handleSliderMove(e: MouseEvent | TouchEvent) {
		if (!isDraggingCompare || !imgRef) return;
		const rect = imgRef.parentElement?.getBoundingClientRect();
		if (!rect) return;

		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const x = clientX - rect.left;
		const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
		compareSlider = percent;
	}

	function handleSliderEnd() {
		isDraggingCompare = false;
	}
</script>

<div class="min-h-screen bg-slate-950 text-slate-200">
	<!-- Header -->
	<header class="border-b border-white/5 px-4 py-3 md:px-6 md:py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3 md:gap-4">
				<a
					href="/"
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
					aria-label="Back"
				>
					<ArrowLeft class="h-4 w-4" />
				</a>
				<h1 class="text-lg font-semibold md:text-xl">{workspace.spaceName}</h1>
				{#if workspace.editCount > 0}
					<span
						class="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-medium text-purple-300"
					>
						{workspace.editCount} edits
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if workspace.status === 'complete' && workspace.glbUrl}
					<a
						href="/world"
						class="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
					>
						<ExternalLink class="h-4 w-4" />
						<span class="hidden sm:inline">View in World</span>
					</a>
				{/if}

				<!-- Sidebar toggle: desktop only -->
				{#if workspace.status !== 'complete'}
					<button
						onclick={() => (isSidebarOpen = !isSidebarOpen)}
						class="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:flex"
						title={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
						aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
					>
						{#if isSidebarOpen}
							<PanelRightClose class="h-4 w-4" />
						{:else}
							<PanelRightOpen class="h-4 w-4" />
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</header>

	<main class="flex h-[calc(100vh-57px)] md:h-[calc(100vh-72px)]">
		<!-- Canvas area -->
		<div
			class="flex flex-1 flex-col p-0 md:p-6 {isMobile && workspace.status === 'forging'
				? 'pb-[220px]'
				: ''}"
		>
			{#if workspace.status === 'complete'}
				<!-- Complete state -->
				<div class="flex h-full flex-col items-center justify-center gap-6 p-8">
					<div class="celebrate">
						<div
							class="relative overflow-hidden rounded-2xl border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
						>
							<img
								src={workspace.currentImageUrl}
								alt={workspace.spaceName}
								class="max-h-[50vh] object-contain"
							/>
							<div
								class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
							></div>
						</div>
					</div>
					<div class="text-center">
						<h2 class="text-2xl font-bold text-white">Space Complete!</h2>
						<p class="mt-2 text-slate-400">Your 3D model is being built in the World view.</p>
					</div>
					<div class="flex gap-3">
						<a
							href="/world"
							class="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-500"
						>
							<Box class="h-5 w-5" />
							View in World
						</a>
						<a
							href="/"
							class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-slate-300 transition-colors hover:bg-white/10"
						>
							Back to Dashboard
						</a>
					</div>
				</div>
			{:else}
				<!-- Canvas + CommandBar stacked -->
				<div class="relative flex-1 overflow-hidden rounded-none bg-black md:rounded-xl">
					<img
						bind:this={imgRef}
						bind:clientWidth={imgWidth}
						bind:clientHeight={imgHeight}
						bind:naturalWidth={natWidth}
						bind:naturalHeight={natHeight}
						src={workspace.currentImageUrl}
						alt="Current"
						class="h-full w-full object-contain"
					/>

					{#if imgRef}
						<canvas
							class="absolute inset-0 z-10 h-full w-full touch-none {editor.maskTool === 'magic'
								? 'cursor-cell'
								: 'cursor-crosshair'}"
							width={canvasWidth}
							height={canvasHeight}
							use:maskCanvas={() => ({
								editor,
								width: canvasWidth,
								height: canvasHeight,
								naturalWidth,
								naturalHeight,
								renderedFrame,
								onMagicClick: handleMagicClick
							})}
						></canvas>
					{/if}

					<!-- Processing overlay -->
					{#if workspace.isProcessing}
						<div
							class="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm"
						>
							<div class="flex flex-col items-center gap-3">
								<div class="relative h-14 w-14">
									<div class="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
									<div
										class="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-purple-500"
										style="animation-duration: 1.2s"
									></div>
								</div>
								<p class="text-sm font-medium text-white/90">Generating...</p>
							</div>
						</div>
					{/if}

					<!-- Magic wand click feedback -->
					{#if magicClickPos}
						<div
							class="pointer-events-none absolute z-20"
							style="left: {magicClickPos.x}px; top: {magicClickPos.y}px; transform: translate(-50%, -50%)"
						>
							<div class="h-12 w-12 animate-ping rounded-full bg-purple-500/40"></div>
							<span
								class="absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded bg-black/80 px-2 py-1 text-[10px] whitespace-nowrap text-white backdrop-blur"
							>
								Detecting object...
							</span>
						</div>
					{/if}

					<!-- Sparkle focus button -->
					{#if editor.hasMask && !workspace.isComparing && !isMobile}
						<button
							class="absolute right-3 bottom-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-slate-900/80 text-purple-300 shadow-lg backdrop-blur-md transition-all hover:bg-purple-500/20 hover:text-purple-200"
							onclick={() => commandBarRef?.focus()}
							title="Describe your edit"
						>
							<Sparkles class="h-5 w-5" />
						</button>
					{/if}

					<!-- Floating Tool Selector -->
					<div
						class="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur-md md:top-4 md:left-4"
					>
						<button
							onclick={() => (editor.maskTool = 'draw')}
							class="flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-8 md:w-8 {editor.maskTool ===
							'draw'
								? 'bg-purple-500/30 text-purple-300'
								: 'text-slate-400 hover:bg-white/10 hover:text-white'}"
							title="Rectangle Select"
							aria-label="Rectangle Select"
						>
							<Square class="h-5 w-5 md:h-4 md:w-4" />
						</button>
						<button
							onclick={() => (editor.maskTool = 'brush')}
							class="flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-8 md:w-8 {editor.maskTool ===
							'brush'
								? 'bg-purple-500/30 text-purple-300'
								: 'text-slate-400 hover:bg-white/10 hover:text-white'}"
							title="Brush Tool"
							aria-label="Brush Tool"
						>
							<Paintbrush class="h-5 w-5 md:h-4 md:w-4" />
						</button>
						<button
							onclick={() => (editor.maskTool = 'poly')}
							class="flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-8 md:w-8 {editor.maskTool ===
							'poly'
								? 'bg-purple-500/30 text-purple-300'
								: 'text-slate-400 hover:bg-white/10 hover:text-white'}"
							title="Polygon Tool"
							aria-label="Polygon Tool"
						>
							<Pentagon class="h-5 w-5 md:h-4 md:w-4" />
						</button>
						<button
							onclick={() => (editor.maskTool = 'magic')}
							class="flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-8 md:w-8 {editor.maskTool ===
							'magic'
								? 'bg-purple-500/30 text-purple-300'
								: 'text-slate-400 hover:bg-white/10 hover:text-white'}"
							title="Magic Wand (AI Select)"
							aria-label="Magic Wand"
						>
							<Wand2 class="h-5 w-5 md:h-4 md:w-4" />
						</button>

						{#if editor.maskTool === 'brush'}
							<div class="ml-1 flex items-center gap-1 border-l border-white/10 pl-2">
								<input
									type="range"
									min="5"
									max="100"
									bind:value={editor.brushSize}
									class="h-1 w-16 cursor-pointer appearance-none rounded-full bg-slate-700 accent-purple-500"
								/>
								<span class="w-5 text-center font-mono text-[10px] text-slate-400"
									>{editor.brushSize}</span
								>
							</div>
						{/if}
					</div>

					{#if workspace.isComparing}
						<!-- Comparison Image Overlay -->
						<div
							class="pointer-events-none absolute inset-0 z-20"
							style="clip-path: inset(0 {100 - compareSlider}% 0 0)"
						>
							<img
								src={workspace.compareImageUrl}
								alt="Compare"
								class="h-full w-full object-contain"
							/>
						</div>

						<div
							class="pointer-events-none absolute top-3 left-3 z-30 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm"
						>
							Before
						</div>
						<div
							class="pointer-events-none absolute top-3 right-3 z-30 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm"
						>
							After
						</div>

						<div
							class="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-white/50 backdrop-blur-sm"
							style="left: {compareSlider}%"
						></div>

						<button
							class="absolute top-1/2 z-40 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
							style="left: {compareSlider}%"
							onmousedown={() => (isDraggingCompare = true)}
							ontouchstart={() => (isDraggingCompare = true)}
							aria-label="Drag to compare"
						>
							<ChevronsLeftRight class="h-5 w-5" />
						</button>

						{#if isDraggingCompare}
							<div
								class="absolute inset-0 z-50 cursor-ew-resize"
								role="none"
								onmousemove={handleSliderMove}
								onmouseup={handleSliderEnd}
								onmouseleave={handleSliderEnd}
								ontouchmove={handleSliderMove}
								ontouchend={handleSliderEnd}
							></div>
						{/if}
					{/if}
				</div>

				<!-- Desktop CommandBar: anchored below canvas -->
				{#if !isMobile}
					<div class="mt-3 hidden md:block">
						<CommandBar
							bind:this={commandBarRef}
							{editor}
							isProcessing={workspace.isProcessing}
							onsubmit={() => handleGenerate()}
							onassetupload={handleAssetUpload}
						/>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Desktop Sidebar -->
		{#if !isMobile && workspace.status !== 'complete'}
			<aside
				class="glass-panel flex w-[340px] flex-col overflow-hidden rounded-2xl border-l border-white/5 bg-[#0f111a]/95 backdrop-blur-xl transition-all duration-300
				{isSidebarOpen ? 'translate-x-0 opacity-100' : 'w-0 translate-x-full overflow-hidden opacity-0'}"
			>
				<div class="custom-scrollbar flex-1 overflow-y-auto p-4">
					<div class="flex flex-col gap-6">
						<EditorBar {editor} isProcessing={workspace.isProcessing} />

						<div class="flex gap-2">
							<button
								onclick={() => workspace.toggleComparison()}
								class="flex-1 rounded-lg py-2 text-sm transition-colors {workspace.isComparing
									? 'bg-purple-600 text-white'
									: 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}"
							>
								{workspace.isComparing ? 'Comparing' : 'Compare'}
							</button>
						</div>

						<!-- Complete & Build 3D button -->
						{#if workspace.versions.length > 0}
							<button
								onclick={() => workspace.complete()}
								disabled={workspace.isProcessing || workspace.hasReachedLimit}
								class="pulse-glow flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:bg-purple-500 hover:shadow-purple-500/25 disabled:opacity-40"
							>
								<Box class="h-5 w-5" />
								Complete & Build 3D
							</button>
						{:else}
							<button
								onclick={() => workspace.complete()}
								disabled={workspace.isProcessing}
								class="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
							>
								<Box class="h-5 w-5" />
								Skip Editing — Use As-Is
							</button>
						{/if}

						<!-- Version history -->
						{#if workspace.versions.length > 0}
							<div class="border-t border-white/5 pt-4">
								<div class="mb-2 flex items-center justify-between">
									<h3 class="text-sm font-medium text-slate-400">History</h3>
								</div>
								<div class="flex gap-2 overflow-x-auto pb-2">
									{#each workspace.versions as version (version.id)}
										<button
											onclick={() => workspace.activate(version.id)}
											class="flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all {version.id ===
											workspace.activeId
												? 'border-purple-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
												: 'border-white/10 hover:scale-105 hover:border-white/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]'}"
										>
											<img
												src={version.imageUrl}
												alt="Step {version.step}"
												class="h-14 w-14 object-cover"
											/>
										</button>
									{/each}
								</div>

								<details class="mt-2">
									<summary
										class="cursor-pointer text-[10px] font-medium text-slate-500 hover:text-slate-300"
										>Show tree view</summary
									>
									<div class="mt-2">
										<VersionTree
											tree={workspace.tree}
											activeId={workspace.activeId}
											compareId={workspace.compareId}
											onselect={(id, e) => {
												if (e.altKey) {
													workspace.setCompareTarget(id);
												} else {
													workspace.activate(id);
												}
											}}
											ondelete={(id) => workspace.delete(id)}
										/>
									</div>
								</details>
							</div>
						{/if}

						<!-- Edit limit warning -->
						{#if workspace.hasReachedLimit}
							<div class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
								<p class="text-xs font-medium text-amber-300">
									Edit limit reached (20 max). Complete your space to build the 3D model.
								</p>
							</div>
						{/if}
					</div>
				</div>
			</aside>
		{/if}
	</main>

	<!-- Mobile Bottom Sheet -->
	{#if isMobile && workspace.status === 'forging'}
		<BottomSheet bind:snap={sheetSnap}>
			<CommandBar
				{editor}
				isProcessing={workspace.isProcessing}
				onsubmit={() => handleGenerate()}
				onassetupload={handleAssetUpload}
			/>

			{#snippet fullContent()}
				<div class="flex flex-col gap-4">
					<CommandBar
						{editor}
						isProcessing={workspace.isProcessing}
						onsubmit={() => handleGenerate()}
						onassetupload={handleAssetUpload}
					/>

					<EditorBar {editor} isProcessing={workspace.isProcessing} />

					<div class="flex gap-2">
						<button
							onclick={() => workspace.toggleComparison()}
							class="flex-1 rounded-lg py-2.5 text-sm transition-colors {workspace.isComparing
								? 'bg-purple-600 text-white'
								: 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}"
						>
							{workspace.isComparing ? 'Comparing' : 'Compare'}
						</button>
					</div>

					<!-- Complete button (mobile) -->
					{#if workspace.versions.length > 0}
						<button
							onclick={() => workspace.complete()}
							disabled={workspace.isProcessing}
							class="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
						>
							<Box class="h-5 w-5" />
							Complete & Build 3D
						</button>
					{:else}
						<button
							onclick={() => workspace.complete()}
							disabled={workspace.isProcessing}
							class="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
						>
							<Box class="h-5 w-5" />
							Skip Editing — Use As-Is
						</button>
					{/if}

					{#if workspace.versions.length > 0}
						<div class="border-t border-white/5 pt-3">
							<h3 class="mb-2 text-xs font-medium text-slate-400">History</h3>
							<div class="flex gap-2 overflow-x-auto pb-2">
								{#each workspace.versions as version (version.id)}
									<button
										onclick={() => workspace.activate(version.id)}
										class="flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all {version.id ===
										workspace.activeId
											? 'border-purple-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
											: 'border-white/10 hover:border-white/20'}"
									>
										<img
											src={version.imageUrl}
											alt="Step {version.step}"
											class="h-16 w-16 object-cover"
										/>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/snippet}
		</BottomSheet>
	{/if}

	<!-- Error toast -->
	{#if workspace.errorMessage}
		<div
			class="animate-in fixed bottom-6 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-center gap-3 overflow-hidden rounded-lg bg-rose-600 px-5 py-3 text-white shadow-lg"
		>
			<span class="text-sm">{workspace.errorMessage}</span>
			<button
				class="ml-auto flex-shrink-0 text-rose-200 hover:text-white"
				onclick={() => (workspace.errorMessage = '')}
			>
				&times;
			</button>
			<div class="absolute right-0 bottom-0 left-0 h-0.5 bg-rose-400/30">
				<div class="animate-shrink h-full bg-rose-300/60"></div>
			</div>
		</div>
	{/if}
</div>
