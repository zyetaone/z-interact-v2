<script lang="ts">
	import { browser } from '$app/environment';
	import { Canvas } from '@threlte/core';
	import { WebGLRenderer, PCFSoftShadowMap, ACESFilmicToneMapping } from 'three';
	import Scene from './scene/Scene.svelte';

	export interface IslandModel {
		id: string;
		name: string;
		imageUrl: string;
		glbUrl?: string;
		editCount: number;
		sortOrder?: number;
	}

	export interface SceneControls {
		resetView: () => void;
		toggleAvatar: () => boolean;
	}

	let {
		models = [],
		totalSlots,
		onroomselect,
		controls = $bindable<SceneControls | null>(null)
	}: {
		models: IslandModel[];
		totalSlots?: number;
		onroomselect?: (room: IslandModel | null) => void;
		controls?: SceneControls | null;
	} = $props();

	let sceneError = $state('');

	function createRenderer(canvas: HTMLCanvasElement) {
		const renderer = new WebGLRenderer({ canvas, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.toneMappingExposure = 1.2;
		return renderer;
	}
</script>

<div class="relative h-full w-full">
	{#if browser}
		<Canvas {createRenderer} shadows={PCFSoftShadowMap} toneMapping={ACESFilmicToneMapping}>
			<Scene {models} {totalSlots} {onroomselect} bind:controls />
		</Canvas>
	{/if}

	{#if sceneError}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<div class="glass rounded-xl p-6 text-center text-sm text-rose-300">
				{sceneError}
			</div>
		</div>
	{/if}
</div>
