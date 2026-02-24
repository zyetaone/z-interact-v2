<script lang="ts">
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fade, scale, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { toast } from '$lib/toast.svelte';
	import IsometricScene, {
		type IslandModel,
		type SceneControls
	} from '$lib/components/IsometricScene.svelte';
	import {
		Globe,
		ChevronLeft,
		Loader2,
		X,
		Gamepad2,
		RotateCcw,
		Keyboard,
		Hammer,
		LayoutGrid,
		GripVertical,
		Check
	} from '@lucide/svelte';
	import { completeSpace } from '../forge/ai.remote';

	let { data } = $props();

	let selectedRoom = $state<IslandModel | null>(null);
	let isCompleting = $state<string | null>(null);
	let completeError = $state('');
	let avatarActive = $state(false);
	let sceneControls = $state<SceneControls | null>(null);
	let showControls = $state(true);
	let showWorldModal = $state(false);
	let showArrangePanel = $state(false);
	let isSaving = $state(false);
	let saveSuccess = $state(false);

	// Mutable ordered models for drag-and-drop
	let orderedModels = $state<IslandModel[]>([...data.models]);

	// Track pending separately so we can reactively remove completed spaces
	let pendingSpaces = $state([...data.pending]);

	// Drag state (pointer-based for mobile support)
	let draggedIdx = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// Check on mount if we should show the world-unlocked reveal
	$effect(() => {
		if (browser && data.allComplete && data.models.length > 0) {
			const revealed = localStorage.getItem('world-revealed');
			if (!revealed) {
				showWorldModal = true;
			}
		}
	});

	function dismissWorldModal() {
		showWorldModal = false;
		if (browser) {
			localStorage.setItem('world-revealed', 'true');
		}
	}

	function handleRoomSelect(room: IslandModel | null) {
		selectedRoom = room;
	}

	async function completeAndAdd(spaceId: string) {
		isCompleting = spaceId;
		completeError = '';

		try {
			await completeSpace({ spaceId });

			// Move from pending to models reactively (no page reload)
			const completed = pendingSpaces.find((ws) => ws.id === spaceId);
			if (completed) {
				orderedModels = [
					...orderedModels,
					{
						id: completed.id,
						name: completed.name,
						imageUrl: completed.imageUrl,
						editCount: 0,
						sortOrder: orderedModels.length
					}
				];
				pendingSpaces = pendingSpaces.filter((ws) => ws.id !== spaceId);
				toast(`${completed.name} added to your world`, 'success');
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to complete space';
			toast(msg, 'error');
			completeError = msg;
		} finally {
			isCompleting = null;
		}
	}

	function toggleAvatar() {
		if (sceneControls) {
			avatarActive = sceneControls.toggleAvatar();
		}
	}

	function resetView() {
		sceneControls?.resetView();
		selectedRoom = null;
	}

	// --- Pointer-based Drag & Drop (mobile-friendly) ---
	function handlePointerDown(e: PointerEvent, index: number) {
		draggedIdx = index;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent, index: number) {
		if (draggedIdx === null || draggedIdx === index) return;
		dragOverIndex = index;
	}

	function handlePointerUp() {
		if (draggedIdx !== null && dragOverIndex !== null && draggedIdx !== dragOverIndex) {
			const moved = orderedModels[draggedIdx];
			const updated = orderedModels.filter((_, i) => i !== draggedIdx);
			updated.splice(dragOverIndex, 0, moved);
			orderedModels = updated;
		}
		draggedIdx = null;
		dragOverIndex = null;
	}

	async function saveOrder() {
		isSaving = true;
		saveSuccess = false;

		try {
			const order = orderedModels.map((m, i) => ({ id: m.id, sortOrder: i }));
			const res = await fetch('/api/reorder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ order })
			});

			if (!res.ok) throw new Error('Failed to save');

			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch {
			completeError = 'Failed to save arrangement';
		} finally {
			isSaving = false;
		}
	}

	// Derived: total hex slots including pending
	const totalSlots = $derived(data.totalSpaces);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && showWorldModal) dismissWorldModal();
	}}
/>

<svelte:head>
	<title>Your World — Workspace Studio</title>
</svelte:head>

<div class="relative h-screen w-screen overflow-hidden bg-slate-950">
	<!-- World Unlocked Modal -->
	{#if showWorldModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center"
			transition:fade={{ duration: 500 }}
		>
			<div class="absolute inset-0 bg-black/95 backdrop-blur-xl"></div>
			<div
				class="relative z-10 flex flex-col items-center px-6 text-center"
				in:scale={{ duration: 600, start: 0.85, easing: cubicOut }}
			>
				<!-- Island count -->
				<div
					class="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-purple-400/50 bg-purple-500/20"
					in:scale={{ delay: 500, duration: 500, start: 0.5, easing: cubicOut }}
				>
					<span class="text-4xl font-bold text-purple-300">{orderedModels.length}</span>
				</div>

				<!-- Title -->
				<h1
					class="mb-3 text-4xl font-extrabold text-white sm:text-5xl"
					in:fade={{ delay: 800, duration: 500 }}
				>
					Your World Is Complete
				</h1>

				<p class="mb-8 max-w-md text-lg text-slate-400" in:fade={{ delay: 1000, duration: 500 }}>
					{orderedModels.length} floating islands, crafted by your choices and imagination.
				</p>

				<!-- CTA -->
				<button
					onclick={dismissWorldModal}
					class="pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500"
					in:fade={{ delay: 1300, duration: 400 }}
				>
					<Globe class="h-5 w-5" />
					Explore Your World
				</button>
			</div>
		</div>
	{/if}

	<!-- Scene -->
	<div class="absolute inset-0" in:fade={{ duration: 800, delay: showWorldModal ? 0 : 200 }}>
		{#if orderedModels.length > 0}
			<IsometricScene
				models={orderedModels}
				{totalSlots}
				onroomselect={handleRoomSelect}
				bind:controls={sceneControls}
			/>
		{:else}
			<!-- Empty state -->
			<div class="flex h-full items-center justify-center">
				<div class="glass mx-4 max-w-md rounded-2xl p-10 text-center">
					<div class="mb-4 flex justify-center">
						<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20">
							<Globe class="h-8 w-8 text-purple-300" />
						</div>
					</div>
					<h2 class="mb-2 text-lg font-semibold text-white">No Islands Yet</h2>
					<p class="mb-5 text-sm text-slate-400">
						Complete your quest and forge spaces to populate your floating island world.
					</p>
					{#if data.pending.length > 0}
						<div class="mb-4 space-y-1.5">
							{#each data.pending as ws (ws.id)}
								<a
									href="{base}/forge/{ws.id}"
									class="flex items-center gap-2 rounded-lg bg-white/5 p-2 hover:bg-white/10"
								>
									<img src={ws.imageUrl} alt={ws.name} class="h-8 w-8 rounded object-cover" />
									<span class="text-xs text-slate-300">{ws.name}</span>
								</a>
							{/each}
						</div>
					{/if}
					<a
						href="{base}/"
						class="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-500"
					>
						<ChevronLeft class="h-4 w-4" />
						Back to Home
					</a>
				</div>
			</div>
		{/if}
	</div>

	<!-- Identity Label -->
	{#if orderedModels.length > 0}
		<div class="absolute top-16 left-1/2 z-20 -translate-x-1/2">
			<div class="glass rounded-full px-5 py-2 text-sm font-medium text-white/90">Your World</div>
		</div>
	{/if}

	<!-- Top Navigation -->
	<nav
		class="slide-up pointer-events-none absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6"
	>
		<a
			href="{base}/"
			class="glass smooth-transition pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-300 hover:scale-105 hover:text-white"
		>
			<ChevronLeft class="h-4 w-4" />
			<span class="hidden sm:inline">Home</span>
		</a>

		<div class="pointer-events-auto flex items-center gap-2">
			<a
				href="{base}/metaverse"
				class="glass smooth-transition flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-300 hover:scale-105 hover:text-white"
			>
				<Globe class="h-4 w-4 text-purple-400" />
				<span class="hidden sm:inline">Metaverse</span>
			</a>
			<div class="glass rounded-full px-4 py-2 text-sm text-slate-300">
				<Globe class="mr-1.5 inline-block h-4 w-4 text-purple-400" />
				{orderedModels.length} island{orderedModels.length !== 1 ? 's' : ''}
			</div>
		</div>
	</nav>

	<!-- Controls Panel -->
	{#if orderedModels.length > 0}
		<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
			<div
				class="glass flex items-center gap-1.5 rounded-full px-2 py-1.5 sm:gap-2 sm:px-3"
				class:mb-[220px]={showArrangePanel}
			>
				<button
					onclick={resetView}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					title="Reset camera"
					aria-label="Reset camera to overview"
				>
					<RotateCcw class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">Overview</span>
				</button>

				<div class="h-5 w-px bg-white/10"></div>

				<button
					onclick={toggleAvatar}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs transition-colors hover:bg-white/10 {avatarActive
						? 'text-purple-300'
						: 'text-slate-300 hover:text-white'}"
					title="Toggle avatar walk mode (WASD)"
					aria-label="Toggle avatar walk mode"
				>
					<Gamepad2 class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">{avatarActive ? 'Walking' : 'Walk'}</span>
				</button>

				<div class="h-5 w-px bg-white/10"></div>

				<button
					onclick={() => {
						showArrangePanel = !showArrangePanel;
						if (showArrangePanel) selectedRoom = null;
					}}
					disabled={isCompleting !== null}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs transition-colors hover:bg-white/10 disabled:opacity-40 {showArrangePanel
						? 'text-purple-300'
						: 'text-slate-300 hover:text-white'}"
					title="Arrange islands"
					aria-label="Arrange islands"
				>
					<LayoutGrid class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">Arrange</span>
				</button>

				<div class="h-5 w-px bg-white/10"></div>

				<button
					onclick={() => (showControls = !showControls)}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					title="Keyboard shortcuts"
					aria-label="Keyboard shortcuts"
				>
					<Keyboard class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		<!-- Keyboard shortcuts help -->
		{#if showControls && !showArrangePanel}
			<div class="slide-up absolute right-4 bottom-20 z-20 sm:right-6">
				<div class="glass rounded-xl p-3 text-[11px] text-slate-400">
					<div class="mb-1.5 flex items-center justify-between">
						<span class="font-medium text-slate-300">Controls</span>
						<button onclick={() => (showControls = false)} class="text-slate-500 hover:text-white">
							<X class="h-3 w-3" />
						</button>
					</div>
					<div class="space-y-1">
						<div><kbd class="kbd">Click</kbd> island to explore</div>
						<div><kbd class="kbd">Esc</kbd> back to overview</div>
						<div><kbd class="kbd">Arrow</kbd> keys to navigate islands</div>
						<div><kbd class="kbd">Scroll</kbd> to zoom</div>
						<div><kbd class="kbd">Drag</kbd> to orbit</div>
						{#if avatarActive}
							<div><kbd class="kbd">WASD</kbd> to walk</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Selected Island Info Panel -->
	{#if selectedRoom && !showArrangePanel}
		<div class="slide-up absolute top-4 right-4 z-20 w-72 sm:top-6 sm:right-6">
			<div class="glass-panel overflow-hidden rounded-2xl">
				<div class="relative aspect-video overflow-hidden">
					<img
						src={selectedRoom.imageUrl}
						alt={selectedRoom.name}
						class="h-full w-full object-cover"
					/>
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
					></div>
					<button
						onclick={resetView}
						class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
						aria-label="Close panel"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				</div>
				<div class="p-4">
					<h3 class="mb-1 text-sm font-semibold text-white">
						{selectedRoom.name}
					</h3>
					<p class="text-xs text-slate-400">
						{selectedRoom.editCount} edit{selectedRoom.editCount !== 1 ? 's' : ''}
					</p>
					<div class="mt-3">
						<a
							href="{base}/forge/{selectedRoom.id}"
							class="flex items-center justify-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 py-2 text-center text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
						>
							<Hammer class="h-3.5 w-3.5" />
							View Space
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pending Spaces Panel -->
	{#if pendingSpaces.length > 0 && !selectedRoom && !showArrangePanel}
		<div class="absolute top-4 right-4 z-20 w-64 sm:top-6 sm:right-6">
			<div class="glass rounded-xl p-4">
				<div class="mb-3 flex items-center gap-2">
					<Hammer class="h-4 w-4 text-purple-400" />
					<h3 class="text-xs font-semibold text-white">In Progress</h3>
				</div>
				<div class="max-h-48 space-y-2 overflow-y-auto">
					{#each pendingSpaces as ws (ws.id)}
						<div class="flex items-center justify-between rounded-lg bg-white/5 p-2">
							<div class="flex items-center gap-2">
								<img src={ws.imageUrl} alt={ws.name} class="h-8 w-8 rounded object-cover" />
								<span class="text-xs text-slate-300">{ws.name}</span>
							</div>
							<button
								onclick={() => completeAndAdd(ws.id)}
								disabled={isCompleting !== null}
								class="flex h-7 items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 text-[10px] font-medium text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
							>
								{#if isCompleting === ws.id}
									<Loader2 class="h-3 w-3 animate-spin" />
								{:else}
									Add
								{/if}
							</button>
						</div>
					{/each}
				</div>
				{#if completeError}
					<div class="mt-2 rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
						{completeError}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Arrange Panel (Hex Grid Drawer) -->
	{#if showArrangePanel}
		<div
			class="absolute right-0 bottom-0 left-0 z-30"
			transition:fly={{ y: 200, duration: 300, easing: cubicOut }}
		>
			<div class="glass-panel border-t border-white/10 px-4 py-4 sm:px-6">
				<!-- Header -->
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<LayoutGrid class="h-4 w-4 text-purple-400" />
						<h3 class="text-xs font-semibold text-white">Arrange Your World</h3>
						<span class="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
							Drag to reorder
						</span>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={saveOrder}
							disabled={isSaving}
							class="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors {saveSuccess
								? 'bg-emerald-600 text-white'
								: 'bg-purple-600 text-white hover:bg-purple-500'} disabled:opacity-50"
						>
							{#if isSaving}
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
							{:else if saveSuccess}
								<Check class="h-3.5 w-3.5" />
								Saved
							{:else}
								Save
							{/if}
						</button>
						<button
							onclick={() => (showArrangePanel = false)}
							class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				</div>

				<!-- Hex grid -->
				<div class="flex gap-2 overflow-x-auto pb-2">
					{#each orderedModels as model, i (model.id)}
						<div
							class="hex-cell group relative flex-shrink-0 cursor-grab select-none active:cursor-grabbing"
							onpointerdown={(e) => handlePointerDown(e, i)}
							onpointermove={(e) => handlePointerMove(e, i)}
							onpointerup={handlePointerUp}
							role="listitem"
						>
							<!-- Position number -->
							<div
								class="absolute -top-1 -left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white shadow"
							>
								{i + 1}
							</div>

							<!-- Hex shape container -->
							<div
								class="hex-shape overflow-hidden transition-all duration-200 {dragOverIndex === i
									? 'scale-110 ring-2 ring-purple-400'
									: ''} {draggedIdx === i ? 'opacity-40' : ''}"
							>
								<img
									src={model.imageUrl}
									alt={model.name}
									class="h-full w-full object-cover"
									draggable="false"
								/>
								<div
									class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
								></div>
							</div>

							<!-- Drag handle -->
							<div
								class="absolute top-1/2 -right-0.5 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<GripVertical class="h-3.5 w-3.5 text-slate-400" />
							</div>

							<!-- Name -->
							<p
								class="mt-1 max-w-[72px] truncate text-center text-[9px] font-medium text-slate-400"
							>
								{model.name}
							</p>
						</div>
					{/each}

					<!-- Empty placeholder slots -->
					{#each Array.from({ length: Math.max(0, data.totalSpaces - orderedModels.length) }, (__, i) => i) as pi (pi)}
						<div class="hex-cell flex-shrink-0">
							<div class="hex-shape hex-empty flex items-center justify-center">
								<div class="text-center">
									<Hammer class="mx-auto h-4 w-4 text-slate-600" />
									<span class="mt-0.5 block text-[8px] text-slate-600">Pending</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.kbd {
		display: inline-block;
		padding: 0 4px;
		font-family: ui-monospace, monospace;
		font-size: 10px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		color: #94a3b8;
	}

	.pulse-glow {
		animation: pulse-glow 2s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
		}
		50% {
			box-shadow: 0 0 40px rgba(147, 51, 234, 0.6);
		}
	}

	.hex-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 80px;
		touch-action: none;
	}

	.hex-shape {
		position: relative;
		width: 72px;
		height: 72px;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
	}

	.hex-empty {
		background: rgba(255, 255, 255, 0.03);
		border: none;
	}

	/* Dashed border illusion for empty hex */
	.hex-empty::before {
		content: '';
		position: absolute;
		inset: 2px;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: repeating-linear-gradient(
			90deg,
			rgba(139, 92, 246, 0.15) 0px,
			rgba(139, 92, 246, 0.15) 3px,
			transparent 3px,
			transparent 6px
		);
	}
</style>
