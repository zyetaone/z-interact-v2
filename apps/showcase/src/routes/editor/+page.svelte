<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import { Editor } from '@zyeta/editor-engine';
	import CommandBar from '@zyeta/editor-engine/components/CommandBar';
	import EditorBar from '@zyeta/editor-engine/components/EditorBar';
	import VersionTree from '@zyeta/editor-engine/components/VersionTree';
	import type { TreeNode } from '@zyeta/shared/types';
	import { MOCK_EDITOR_IMAGE } from '$lib/mock-data';

	const editor = new Editor();

	let isProcessing = $state(false);
	let currentImage = $state(MOCK_EDITOR_IMAGE);
	let activeVersionId = $state<string | null>('v3');

	const versionTree: TreeNode[] = [
		{
			id: 'v1',
			step: 1,
			parentId: null,
			imageUrl: 'https://picsum.photos/seed/edit-v1/100/100',
			prompt: 'Original workspace',
			createdAt: '2025-01-01T00:00:00Z',
			versionLabel: '1',
			children: [
				{
					id: 'v2',
					step: 2,
					parentId: 'v1',
					imageUrl: 'https://picsum.photos/seed/edit-v2/100/100',
					prompt: 'Add standing desk with monitor',
					createdAt: '2025-01-01T01:00:00Z',
					versionLabel: '1.1',
					children: [
						{
							id: 'v3',
							step: 3,
							parentId: 'v2',
							imageUrl: 'https://picsum.photos/seed/edit-v3/100/100',
							prompt: 'Add warm ambient lighting',
							createdAt: '2025-01-01T02:00:00Z',
							versionLabel: '1.1.1',
							children: []
						}
					]
				},
				{
					id: 'v4',
					step: 2,
					parentId: 'v1',
					imageUrl: 'https://picsum.photos/seed/edit-v4/100/100',
					prompt: 'Remove clutter, make minimal',
					createdAt: '2025-01-01T01:30:00Z',
					versionLabel: '1.2',
					children: []
				}
			]
		}
	];

	function handleSubmit() {
		if (!editor.canGenerate || isProcessing) return;
		isProcessing = true;
		setTimeout(() => {
			currentImage = `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/800/600`;
			editor.prompt = '';
			editor.clearMask();
			isProcessing = false;
		}, 2000);
	}

	function handleVersionSelect(id: string | null) {
		activeVersionId = id;
		if (id) {
			const flat = flattenTree(versionTree);
			const node = flat.find((n) => n.id === id);
			if (node?.imageUrl) currentImage = node.imageUrl;
		}
	}

	function flattenTree(nodes: TreeNode[]): TreeNode[] {
		return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
	}
</script>

<svelte:head>
	<title>2D Editor - Zyeta Showcase</title>
</svelte:head>

<div class="flex h-screen flex-col">
	<!-- Header -->
	<div class="flex items-center gap-4 border-b border-white/5 px-4 py-3">
		<a
			href="/"
			class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-400 backdrop-blur-sm transition-colors hover:bg-slate-950 hover:text-white"
		>
			<ArrowLeft class="h-4 w-4" />
			Showcase
		</a>
		<div>
			<h1 class="text-lg font-semibold text-white">2D Editor</h1>
			<p class="text-xs text-slate-400">AI-powered workspace image editing</p>
		</div>
	</div>

	<!-- Main layout -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Canvas area -->
		<div class="relative flex flex-1 items-center justify-center bg-slate-900/50 p-6">
			{#if isProcessing}
				<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500"
					></div>
				</div>
			{/if}
			<img
				src={currentImage}
				alt="Workspace canvas"
				class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
				class:opacity-50={isProcessing}
			/>
		</div>

		<!-- Sidebar -->
		<div class="flex w-72 flex-col gap-4 overflow-y-auto border-l border-white/5 p-4">
			<EditorBar {editor} {isProcessing} />
			<div>
				<h3 class="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">Versions</h3>
				<VersionTree
					tree={versionTree}
					activeId={activeVersionId}
					onselect={(id: string | null) => handleVersionSelect(id)}
				/>
			</div>
		</div>
	</div>

	<!-- Bottom command bar -->
	<div class="border-t border-white/5 px-4 py-3">
		<CommandBar {editor} {isProcessing} onsubmit={handleSubmit} />
	</div>

	<LayerBar />
</div>
