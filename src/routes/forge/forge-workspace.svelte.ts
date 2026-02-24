import type { Version, TreeNode, MaskData } from '$lib/types/workspace';
import type { Space } from '$lib/server/db/schema';
import { buildTree, isLeafNode } from '$lib/utils/version-tree';
import { editImage, deleteImage, completeSpace } from './ai.remote';

const MAX_EDITS = 20;

interface SpaceSummary {
	id: string;
	name: string;
	status: string;
	sortOrder: number;
}

interface ForgeInit {
	space: Space;
	history: Version[];
	allSpaces?: SpaceSummary[];
}

export class ForgeWorkspace {
	versions = $state<Version[]>([]);
	activeId = $state<string | null>(null);
	status = $state<'forging' | 'complete'>('forging');
	editCount = $state(0);
	originalImageUrl = $state('');
	spaceId = $state('');
	spaceName = $state('');
	isProcessing = $state(false);
	isCompleting = $state(false);
	errorMessage = $state('');
	compareId = $state<string | null>(null);
	isComparing = $state(false);
	allSpaces = $state<SpaceSummary[]>([]);
	showCompletionModal = $state(false);

	readonly tree: TreeNode[] = $derived(buildTree(this.versions));

	readonly completedCount: number = $derived(
		this.allSpaces.filter((s) => s.status === 'complete').length
	);

	readonly totalSpaces: number = $derived(this.allSpaces.length);

	readonly nextSpaceId: string | null = $derived.by(() => {
		const sorted = [...this.allSpaces].sort((a, b) => a.sortOrder - b.sortOrder);
		const incomplete = sorted.find((s) => s.status !== 'complete' && s.id !== this.spaceId);
		return incomplete?.id ?? null;
	});

	readonly allComplete: boolean = $derived(
		this.allSpaces.length > 0 &&
			this.allSpaces.every((s) => s.status === 'complete' || s.id === this.spaceId) &&
			this.status === 'complete'
	);

	readonly activeVersion: Version | undefined = $derived(
		this.versions.find((v) => v.id === this.activeId)
	);

	readonly currentImageUrl: string = $derived(
		this.activeVersion?.imageUrl ?? this.originalImageUrl
	);

	readonly compareImageUrl: string = $derived.by(() => {
		if (!this.compareId) return this.originalImageUrl;
		const v = this.versions.find((ver) => ver.id === this.compareId);
		return v?.imageUrl ?? this.originalImageUrl;
	});

	readonly hasReachedLimit: boolean = $derived(this.editCount >= MAX_EDITS);

	constructor(init: ForgeInit) {
		this.spaceId = init.space.id;
		this.spaceName = init.space.name;
		this.originalImageUrl = init.space.originalImageUrl;
		this.editCount = init.space.editCount;
		this.activeId = init.space.activeNodeId;
		this.status = init.space.status === 'complete' ? 'complete' : 'forging';
		this.versions = init.history;
		this.allSpaces = init.allSpaces ?? [];
	}

	async generate(
		prompt: string,
		mask?: MaskData,
		mode?: 'add' | 'subtract' | 'modify',
		strength?: number
	) {
		if (this.isProcessing || this.hasReachedLimit) return;
		this.isProcessing = true;
		this.errorMessage = '';

		try {
			const result = await editImage({
				spaceId: this.spaceId,
				prompt,
				maskUrl: mask?.aiMaskUrl ?? undefined,
				assetUrl: mask?.assetUrl ?? undefined,
				mode,
				strength
			});

			this.versions = [...this.versions, result.node];
			this.activeId = result.node.id;
			this.editCount = result.space.editCount;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Edit failed';
		} finally {
			this.isProcessing = false;
		}
	}

	activate(versionId: string | null) {
		this.activeId = versionId;
		if (this.isComparing && versionId === this.compareId) {
			this.isComparing = false;
			this.compareId = null;
		}
	}

	async delete(versionId: string) {
		if (this.isProcessing) return;
		if (!isLeafNode(versionId, this.versions)) {
			this.errorMessage = 'Cannot delete a node with children';
			return;
		}

		this.isProcessing = true;
		this.errorMessage = '';

		try {
			const result = await deleteImage({
				spaceId: this.spaceId,
				nodeId: versionId
			});

			this.versions = this.versions.filter((v) => v.id !== versionId);
			this.activeId = result.space.activeNodeId;
			this.editCount = result.space.editCount;

			if (this.compareId === versionId) {
				this.compareId = null;
				this.isComparing = false;
			}
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Delete failed';
		} finally {
			this.isProcessing = false;
		}
	}

	async complete() {
		if (this.isProcessing || this.status === 'complete') return;
		this.isProcessing = true;
		this.isCompleting = true;
		this.errorMessage = '';

		try {
			await completeSpace({ spaceId: this.spaceId });
			this.status = 'complete';
			// Update this space's status in allSpaces
			this.allSpaces = this.allSpaces.map((s) =>
				s.id === this.spaceId ? { ...s, status: 'complete' } : s
			);
			this.showCompletionModal = true;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Failed to complete space';
		} finally {
			this.isProcessing = false;
			this.isCompleting = false;
		}
	}

	toggleComparison() {
		if (this.isComparing) {
			this.isComparing = false;
			this.compareId = null;
		} else if (this.versions.length > 0) {
			this.isComparing = true;
			this.compareId = null;
		}
	}

	setCompareTarget(id: string | null) {
		this.compareId = id;
		if (id && !this.isComparing) {
			this.isComparing = true;
		}
	}
}
