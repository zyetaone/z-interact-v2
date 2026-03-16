<script lang="ts">
	import { ChevronDown, ChevronRight, Trash2 } from '@lucide/svelte';
	import type { TreeNode } from '@zyeta/shared/types';

	let {
		tree,
		activeId,
		compareId,
		onselect,
		ondelete
	}: {
		tree: TreeNode[];
		activeId: string | null;
		compareId?: string | null;
		onselect: (id: string | null, e: MouseEvent) => void;
		ondelete?: (id: string) => void;
	} = $props();

	let expandedIds = $state<string[]>([]);

	function toggleExpand(id: string) {
		const index = expandedIds.indexOf(id);
		if (index > -1) {
			expandedIds.splice(index, 1);
		} else {
			expandedIds.push(id);
		}
		expandedIds = [...expandedIds];
	}

	function promptPreview(prompt: string): string {
		return prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt;
	}
</script>

{#snippet nodeRenderer(node: TreeNode, depth: number)}
	{@const hasChildren = node.children.length > 0}
	{@const isExpanded = expandedIds.includes(node.id)}
	{@const isActive = activeId === node.id}
	{@const isComparing = compareId === node.id}
	<div class="flex flex-col">
		<div
			class="group flex items-center gap-2 rounded-lg py-2 pr-2 transition-colors {isActive
				? 'bg-purple-500/20'
				: isComparing
					? 'bg-emerald-500/10'
					: 'hover:bg-white/5'}"
			style="padding-left: {depth * 16 + 8}px"
		>
			<button
				onclick={() => hasChildren && toggleExpand(node.id)}
				class="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors {hasChildren
					? 'hover:bg-white/10 hover:text-white'
					: 'invisible'}"
				aria-label={isExpanded ? 'Collapse version' : 'Expand version'}
				aria-expanded={hasChildren ? isExpanded : undefined}
			>
				{#if isExpanded}
					<ChevronDown class="h-3.5 w-3.5" />
				{:else}
					<ChevronRight class="h-3.5 w-3.5" />
				{/if}
			</button>

			<button
				onclick={(e) => onselect(node.id, e)}
				class="flex flex-1 items-center gap-3 text-left"
			>
				<div
					class="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-800 ring-1 {isActive
						? 'ring-purple-400'
						: isComparing
							? 'ring-emerald-400'
							: 'ring-white/10'}"
				>
					{#if node.imageUrl}
						<img src={node.imageUrl} alt="v{node.step}" class="h-full w-full object-cover" />
					{/if}
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-xs font-medium {isComparing ? 'text-emerald-300' : 'text-slate-300'}"
						>v{node.versionLabel}</span
					>
					<span class="truncate text-[10px] text-slate-500">{promptPreview(node.prompt)}</span>
				</div>
			</button>

			{#if ondelete}
				<button
					onclick={(e) => {
						e.stopPropagation();
						ondelete?.(node.id);
					}}
					class="flex h-8 w-8 items-center justify-center rounded text-slate-500 opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400"
					title="Delete version"
					aria-label="Delete version {node.versionLabel}"
				>
					<Trash2 class="h-3 w-3" />
				</button>
			{/if}
		</div>

		{#if hasChildren && isExpanded}
			<div class="flex flex-col">
				{#each node.children as child (child.id)}
					{@render nodeRenderer(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="glass-panel flex flex-col rounded-xl p-3">
	{#if tree.length === 0}
		<div class="py-8 text-center text-sm text-slate-500">No versions yet</div>
	{:else}
		<div class="flex flex-col gap-0.5">
			{#each tree as root (root.id)}
				{@render nodeRenderer(root, 0)}
			{/each}
		</div>
	{/if}
</div>
