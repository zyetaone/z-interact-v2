<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		open = false,
		onclose,
		label = 'Modal dialog',
		children
	}: {
		open: boolean;
		onclose?: () => void;
		label?: string;
		children?: Snippet;
	} = $props();

	let modalEl = $state<HTMLDivElement>();

	$effect(() => {
		if (open && typeof document !== 'undefined') {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});

	// Focus first focusable element when modal opens
	$effect(() => {
		if (open && modalEl) {
			const focusable = modalEl.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length > 0) {
				focusable[0].focus();
			}
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && onclose) {
			onclose();
		}
		if (e.key === 'Tab' && modalEl) {
			const focusable = modalEl.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
		bind:this={modalEl}
		onkeydown={handleKeydown}
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
