<script lang="ts">
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import IsometricScene, {
		type IslandModel,
		type SceneControls
	} from '$lib/components/IsometricScene.svelte';
	import {
		Globe,
		ChevronLeft,
		Box,
		Loader2,
		X,
		Gamepad2,
		RotateCcw,
		Keyboard,
		Hammer
	} from '@lucide/svelte';

	let { data } = $props();

	let selectedRoom = $state<IslandModel | null>(null);
	let isGenerating3d = $state<string | null>(null);
	let generateError = $state('');
	let avatarActive = $state(false);
	let sceneControls = $state<SceneControls | null>(null);
	let showControls = $state(true);
	let showWorldModal = $state(false);

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

	async function generate3d(spaceId: string) {
		isGenerating3d = spaceId;
		generateError = '';

		try {
			const res = await fetch('/api/iso', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spaceId })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Generation failed' }));
				throw new Error(err.message || `HTTP ${res.status}`);
			}

			window.location.reload();
		} catch (e) {
			generateError = e instanceof Error ? e.message : '3D generation failed';
		} finally {
			isGenerating3d = null;
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
</script>

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
					<span class="text-4xl font-bold text-purple-300">{data.models.length}</span>
				</div>

				<!-- Title -->
				<h1
					class="mb-3 text-4xl font-extrabold text-white sm:text-5xl"
					in:fade={{ delay: 800, duration: 500 }}
				>
					Your World Is Complete
				</h1>

				<p class="mb-8 max-w-md text-lg text-slate-400" in:fade={{ delay: 1000, duration: 500 }}>
					{data.models.length} floating islands, crafted by your choices and imagination.
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
		{#if data.models.length > 0}
			<IsometricScene
				models={data.models}
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
						<p class="mb-4 text-xs text-slate-500">
							{data.pending.length} space{data.pending.length !== 1 ? 's' : ''} ready for 3D generation
						</p>
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
				{data.models.length} island{data.models.length !== 1 ? 's' : ''}
			</div>
		</div>
	</nav>

	<!-- Controls Panel -->
	{#if data.models.length > 0}
		<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
			<div class="glass flex items-center gap-1.5 rounded-full px-2 py-1.5 sm:gap-2 sm:px-3">
				<button
					onclick={resetView}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					title="Reset camera"
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
				>
					<Gamepad2 class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">{avatarActive ? 'Walking' : 'Walk'}</span>
				</button>

				<div class="h-5 w-px bg-white/10"></div>

				<button
					onclick={() => (showControls = !showControls)}
					class="smooth-transition flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					title="Keyboard shortcuts"
				>
					<Keyboard class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		<!-- Keyboard shortcuts help -->
		{#if showControls}
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
	{#if selectedRoom}
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
							Open in Forge
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pending 3D Generation Panel -->
	{#if data.pending.length > 0 && !selectedRoom}
		<div class="absolute top-4 right-4 z-20 w-64 sm:top-6 sm:right-6">
			<div class="glass rounded-xl p-4">
				<div class="mb-3 flex items-center gap-2">
					<Box class="h-4 w-4 text-purple-400" />
					<h3 class="text-xs font-semibold text-white">Pending 3D</h3>
				</div>
				<div class="max-h-48 space-y-2 overflow-y-auto">
					{#each data.pending as ws (ws.id)}
						<div class="flex items-center justify-between rounded-lg bg-white/5 p-2">
							<div class="flex items-center gap-2">
								<img src={ws.imageUrl} alt={ws.name} class="h-8 w-8 rounded object-cover" />
								<span class="text-xs text-slate-300">{ws.name}</span>
							</div>
							<button
								onclick={() => generate3d(ws.id)}
								disabled={isGenerating3d !== null}
								class="flex h-7 items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 text-[10px] font-medium text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
							>
								{#if isGenerating3d === ws.id}
									<Loader2 class="h-3 w-3 animate-spin" />
								{:else}
									<Box class="h-3 w-3" />
								{/if}
								3D
							</button>
						</div>
					{/each}
				</div>
				{#if generateError}
					<div class="mt-2 rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
						{generateError}
					</div>
				{/if}
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
</style>
