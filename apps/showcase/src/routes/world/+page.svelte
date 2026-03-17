<script lang="ts">
	import { ArrowLeft, RotateCcw, User } from '@lucide/svelte';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import { IsometricScene } from '@zyeta/world-engine';
	import { MOCK_ISLANDS } from '$lib/mock-data';
	import type { IslandModel } from '$lib/mock-data';

	let controls = $state<{ resetView: () => void; toggleAvatar: () => boolean } | null>(null);
	let selectedRoom = $state<IslandModel | null>(null);
</script>

<svelte:head>
	<title>3D World - Zyeta Showcase</title>
</svelte:head>

<div class="relative flex h-screen flex-col">
	<!-- Header -->
	<div class="absolute top-0 right-0 left-0 z-10 flex items-center gap-4 p-4">
		<a
			href="/"
			class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-400 backdrop-blur-sm transition-colors hover:bg-slate-950 hover:text-white"
		>
			<ArrowLeft class="h-4 w-4" />
			Showcase
		</a>
		<div>
			<h1 class="text-lg font-semibold text-white">3D World</h1>
			<p class="text-xs text-slate-400">{MOCK_ISLANDS.length} islands</p>
		</div>
	</div>

	<!-- 3D Scene -->
	<div class="flex-1">
		<IsometricScene
			models={MOCK_ISLANDS}
			totalSlots={10}
			onroomselect={(room) => (selectedRoom = room)}
			bind:controls
		/>
	</div>

	<!-- Bottom controls -->
	<div class="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 gap-2">
		<button
			onclick={() => controls?.resetView()}
			class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-300 backdrop-blur-sm transition-colors hover:bg-slate-950 hover:text-white"
		>
			<RotateCcw class="h-4 w-4" />
			Reset
		</button>
		<button
			onclick={() => controls?.toggleAvatar()}
			class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-300 backdrop-blur-sm transition-colors hover:bg-slate-950 hover:text-white"
		>
			<User class="h-4 w-4" />
			Avatar
		</button>
	</div>

	<LayerBar />

	<!-- Selected room panel -->
	{#if selectedRoom}
		<div
			class="absolute right-4 bottom-24 z-10 w-56 rounded-xl border border-white/10 bg-slate-950/90 p-3 backdrop-blur-sm"
		>
			<div class="flex items-center gap-3">
				<img
					src={selectedRoom.imageUrl}
					alt={selectedRoom.name}
					class="h-12 w-12 rounded-lg object-cover"
				/>
				<div class="min-w-0">
					<p class="truncate text-sm font-medium text-white">{selectedRoom.name}</p>
					<p class="text-xs text-slate-400">{selectedRoom.editCount} edits</p>
				</div>
			</div>
		</div>
	{/if}
</div>
