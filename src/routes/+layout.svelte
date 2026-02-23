<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	// Full-screen routes that don't show the nav
	const isFullScreen = $derived(
		page.url.pathname === '/' ||
			page.url.pathname.startsWith('/quest') ||
			page.url.pathname.startsWith('/forge') ||
			page.url.pathname.startsWith('/world') ||
			page.url.pathname.startsWith('/metaverse')
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main>
	{@render children()}
</main>
