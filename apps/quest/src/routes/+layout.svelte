<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="Design your ideal workspace through an interactive quest. Make choices, forge spaces with AI, and explore your floating island world."
	/>
	<meta name="theme-color" content="#0f172a" />
	<meta property="og:site_name" content="ZyetaDX Studio" />
	<meta property="og:type" content="website" />
</svelte:head>

<main>
	{@render children()}
</main>

<Toast />
