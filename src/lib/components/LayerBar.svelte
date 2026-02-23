<script lang="ts">
	import { PenTool, Globe, Film } from '@lucide/svelte';
	import { base } from '$app/paths';

	interface LayerConfig {
		available: boolean;
	}

	interface Props {
		activeLayer: 'canvas' | 'world' | 'video';
		spaceId?: string | null;
		layers: {
			canvas: LayerConfig;
			world: LayerConfig;
			video: LayerConfig;
		};
		class?: string;
	}

	let { activeLayer, spaceId = null, layers, class: className = '' }: Props = $props();

	const tabs = $derived([
		{
			key: 'canvas' as const,
			label: '2D',
			icon: PenTool,
			href: spaceId ? `${base}/forge/${spaceId}` : null,
			available: layers.canvas.available
		},
		{
			key: 'world' as const,
			label: '3D',
			icon: Globe,
			href: `${base}/world`,
			available: layers.world.available
		},
		{
			key: 'video' as const,
			label: 'Video',
			icon: Film,
			href: null,
			available: layers.video.available
		}
	]);
</script>

<nav
	class="glass flex items-center gap-1 rounded-full px-1.5 py-1 {className}"
	aria-label="Creative layers"
>
	{#each tabs as tab (tab.key)}
		{@const Icon = tab.icon}
		{@const isActive = tab.key === activeLayer}
		{@const isDisabled = !tab.available || (!tab.href && !isActive)}
		{#if isActive}
			<div
				class="flex items-center gap-1.5 rounded-full bg-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-200"
			>
				<Icon class="h-3.5 w-3.5" />
				{tab.label}
			</div>
		{:else if isDisabled}
			<div
				class="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600"
				title="Not available yet"
			>
				<Icon class="h-3.5 w-3.5" />
				{tab.label}
			</div>
		{:else}
			<a
				href={tab.href}
				class="smooth-transition flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white"
			>
				<Icon class="h-3.5 w-3.5" />
				{tab.label}
			</a>
		{/if}
	{/each}
</nav>
