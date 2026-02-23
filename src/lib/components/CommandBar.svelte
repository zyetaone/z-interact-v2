<script lang="ts">
	import { Plus, Minus, Sparkles, Send, Eraser, ImagePlus, Trash2 } from '@lucide/svelte';
	import { MAX_FIELD_LENGTH } from '$lib/utils/edit-prompt';
	import type { Editor } from '$lib/editor.svelte';

	let {
		editor,
		isProcessing,
		onsubmit,
		onassetupload
	}: {
		editor: Editor;
		isProcessing: boolean;
		onsubmit: () => void;
		onassetupload?: (file: File) => void;
	} = $props();

	let inputRef: HTMLInputElement | undefined = $state();

	const modes: {
		key: 'add' | 'subtract' | 'modify';
		label: string;
		icon: typeof Plus;
		active: string;
	}[] = [
		{ key: 'add', label: 'Add', icon: Plus, active: 'bg-emerald-500/20 text-emerald-300' },
		{ key: 'subtract', label: 'Remove', icon: Minus, active: 'bg-rose-500/20 text-rose-300' },
		{ key: 'modify', label: 'Modify', icon: Sparkles, active: 'bg-blue-500/20 text-blue-300' }
	];

	const suggestions = $derived.by(() => {
		switch (editor.mode) {
			case 'add':
				return ['desk', 'plant', 'lamp', 'monitor', 'shelf'];
			case 'subtract':
				return ['clutter', 'cables', 'chair', 'cup'];
			case 'modify':
				return ['modern', 'warm lighting', 'minimal', 'cozy'];
		}
	});

	const autoMode = $derived.by(() => {
		const p = editor.prompt.toLowerCase();
		if (/\b(add|place|put|insert|include)\b/.test(p)) return 'add';
		if (/\b(remove|delete|clear|erase|hide)\b/.test(p)) return 'subtract';
		if (/\b(change|make|adjust|turn|transform|modify)\b/.test(p)) return 'modify';
		return null;
	});

	function addSuggestion(chip: string) {
		editor.prompt += (editor.prompt ? ', ' : '') + chip;
		inputRef?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && editor.canGenerate && !isProcessing) {
			e.preventDefault();
			onsubmit();
		}
	}

	export function focus() {
		inputRef?.focus();
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Row 1: Mode chips + Prompt + Generate -->
	<div class="flex items-center gap-2">
		<!-- Mode chips -->
		<div class="flex gap-1">
			{#each modes as m (m.key)}
				<button
					onclick={() => (editor.mode = m.key)}
					class="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-all {editor.mode ===
					m.key
						? m.active
						: autoMode === m.key
							? 'bg-white/5 text-slate-300 ring-1 ring-white/20 ring-inset'
							: 'bg-white/5 text-slate-400 hover:bg-white/10'}"
				>
					<m.icon class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">{m.label}</span>
				</button>
			{/each}
		</div>

		<!-- Prompt input -->
		<input
			bind:this={inputRef}
			type="text"
			bind:value={editor.prompt}
			onkeydown={handleKeydown}
			placeholder="Describe the change..."
			disabled={isProcessing}
			maxlength={MAX_FIELD_LENGTH}
			class="glass-input h-9 min-w-0 flex-1 rounded-lg px-3 text-sm text-white placeholder-slate-500 focus:outline-none"
		/>

		<!-- Generate button -->
		<button
			onclick={onsubmit}
			disabled={!editor.canGenerate || isProcessing}
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
			aria-label="Generate"
		>
			{#if isProcessing}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
			{:else}
				<Send class="h-4 w-4" />
			{/if}
		</button>
	</div>

	<!-- Row 2: Asset upload + Mask indicator + Brush size (contextual) + Suggestions -->
	<div class="flex items-center gap-2">
		<!-- Asset upload -->
		{#if editor.assetUrl}
			<div
				class="group relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-purple-500/50 bg-slate-800"
			>
				<img src={editor.assetUrl} alt="Asset" class="h-full w-full object-cover" />
				<button
					onclick={() => (editor.assetUrl = null)}
					class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
					title="Remove Asset"
				>
					<Trash2 class="h-3 w-3 text-white" />
				</button>
			</div>
		{:else if onassetupload}
			<label
				class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
				title="Upload reference image"
			>
				<ImagePlus class="h-3.5 w-3.5" />
				<input
					type="file"
					accept="image/*"
					class="hidden"
					onchange={(e) => {
						const file = e.currentTarget.files?.[0];
						if (file) onassetupload?.(file);
					}}
				/>
			</label>
		{/if}

		<!-- Mask indicator -->
		{#if editor.hasMask}
			<div class="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-2 py-1">
				<span class="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
				<span class="text-[10px] font-medium text-purple-300">Mask</span>
				<button
					onclick={() => editor.clearMask()}
					disabled={isProcessing}
					class="ml-0.5 text-slate-400 transition-colors hover:text-rose-400 disabled:opacity-50"
					title="Clear mask"
				>
					<Eraser class="h-3 w-3" />
				</button>
			</div>
		{/if}

		<!-- Brush size (when brush tool active) -->
		{#if editor.maskTool === 'brush'}
			<div class="flex items-center gap-1.5">
				<input
					type="range"
					min="5"
					max="100"
					bind:value={editor.brushSize}
					class="h-1 w-14 cursor-pointer appearance-none rounded-full bg-slate-700 accent-purple-500"
				/>
				<span class="w-5 text-center font-mono text-[10px] text-slate-400">{editor.brushSize}</span>
			</div>
		{/if}

		<!-- Divider -->
		{#if editor.hasMask || editor.assetUrl || editor.maskTool === 'brush'}
			<div class="h-4 w-px bg-white/10"></div>
		{/if}

		<!-- Suggestion chips -->
		<div class="flex flex-1 gap-1 overflow-x-auto">
			{#each suggestions as chip (chip)}
				<button
					onclick={() => addSuggestion(chip)}
					disabled={isProcessing}
					class="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
				>
					{chip}
				</button>
			{/each}
		</div>
	</div>
</div>
