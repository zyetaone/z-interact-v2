<script lang="ts">
	import type { Editor } from '$lib/editor.svelte';

	let {
		editor,
		isProcessing
	}: {
		editor: Editor;
		isProcessing: boolean;
	} = $props();

	const strengthPercent = $derived(Math.round(editor.strength * 100));
</script>

<div class="glass-panel flex flex-col gap-4 rounded-xl p-4">
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<label for="strength-slider" class="text-xs font-medium text-slate-400">Strength</label>
			<span class="text-xs font-medium text-purple-300">{strengthPercent}%</span>
		</div>
		<input
			id="strength-slider"
			type="range"
			min="0"
			max="1"
			step="0.05"
			bind:value={editor.strength}
			disabled={isProcessing}
			class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-purple-500 disabled:cursor-not-allowed"
		/>
	</div>
</div>
