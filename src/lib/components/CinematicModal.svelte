<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		open = false,
		onclose,
		children
	}: {
		open: boolean;
		onclose?: () => void;
		children?: Snippet;
	} = $props();

	$effect(() => {
		if (open && typeof document !== 'undefined') {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onclose) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center"
		transition:fade={{ duration: 300 }}
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/90 backdrop-blur-xl"></div>

		<!-- Content -->
		<div
			class="relative z-10 flex max-w-lg flex-col items-center px-6 text-center"
			in:scale={{ duration: 500, start: 0.9, easing: cubicOut }}
		>
			{#if children}
				{@render children()}
			{/if}
		</div>
	</div>
{/if}
