<script lang="ts">
	import { getToasts, dismissToast } from '../utils/toast.svelte';
	import { fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';

	const toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div
		class="fixed top-4 right-4 z-[200] flex flex-col gap-2"
		role="region"
		aria-label="Notifications"
		aria-live="polite"
	>
		{#each toasts as t (t.id)}
			<div
				class="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md
					{t.type === 'error'
					? 'border-rose-500/20 bg-rose-950/80 text-rose-200'
					: t.type === 'success'
						? 'border-emerald-500/20 bg-emerald-950/80 text-emerald-200'
						: 'border-white/10 bg-slate-900/80 text-slate-200'}"
				role={t.type === 'error' ? 'alert' : 'status'}
				transition:fly={{ x: 100, duration: 250 }}
			>
				<span class="max-w-xs">{t.message}</span>
				<button
					onclick={() => dismissToast(t.id)}
					class="flex-shrink-0 text-white/40 transition-colors hover:text-white"
					aria-label="Dismiss notification"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		{/each}
	</div>
{/if}
