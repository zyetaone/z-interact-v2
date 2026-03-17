<script lang="ts">
	import { browser } from '$app/environment';
	import { Canvas } from '@threlte/core';
	import { WebGLRenderer, PCFShadowMap, ACESFilmicToneMapping } from 'three';
	import OfficeFloor from './building/OfficeFloor.svelte';
	import type { IslandModel, BuildingControls } from './types';

	let {
		rooms = [],
		onroomselect,
		controls = $bindable<BuildingControls | null>(null)
	}: {
		rooms: IslandModel[];
		onroomselect?: (room: IslandModel | null) => void;
		controls?: BuildingControls | null;
	} = $props();

	function createRenderer(canvas: HTMLCanvasElement) {
		const renderer = new WebGLRenderer({ canvas, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.toneMappingExposure = 1.2;
		return renderer;
	}
</script>

<div class="relative h-full w-full">
	{#if browser}
		<Canvas {createRenderer} shadows={PCFShadowMap} toneMapping={ACESFilmicToneMapping}>
			<OfficeFloor {rooms} {onroomselect} bind:controls />
		</Canvas>
	{/if}
</div>
