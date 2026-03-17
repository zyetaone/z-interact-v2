<script lang="ts">
	import { PenTool, Globe, Film } from '@lucide/svelte';
	import { page } from '$app/state';

	type Layer = 'editor' | 'world' | 'video';

	const layers = [
		{ id: 'editor' as Layer, href: '/editor', label: '2D', icon: PenTool, color: 'purple' },
		{ id: 'world' as Layer, href: '/world', label: '3D', icon: Globe, color: 'cyan' },
		{ id: 'video' as Layer, href: '/video', label: 'Video', icon: Film, color: 'amber' }
	] as const;

	const activeLayer: Layer = $derived(
		page.url.pathname.startsWith('/editor')
			? 'editor'
			: page.url.pathname.startsWith('/world')
				? 'world'
				: 'video'
	);
</script>

<nav class="glass fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-1.5">
	{#each layers as layer (layer.id)}
		{@const isActive = activeLayer === layer.id}
		<a
			href={layer.href}
			class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200
				{isActive
				? layer.color === 'purple'
					? 'bg-purple-500/20 text-purple-300'
					: layer.color === 'cyan'
						? 'bg-cyan-500/20 text-cyan-300'
						: 'bg-amber-500/20 text-amber-300'
				: 'text-slate-400 hover:text-white'}"
			aria-current={isActive ? 'page' : undefined}
		>
			<layer.icon class="h-3.5 w-3.5" />
			{layer.label}
		</a>
	{/each}
</nav>
