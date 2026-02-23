import { pushState } from '$app/navigation';
import type { Version, WorkspaceStatus, MaskData } from '$lib/types/workspace';
import { buildTree } from '$lib/utils/version-tree';
import { MAX_EDITS_PER_TABLE } from '$lib/config/tables';
import { editImage, lockImage, deleteImage } from '../ai.remote';

export class Workspace {
	versions = $state<Version[]>([]);
	activeId = $state<string | null>(null);
	status = $state<WorkspaceStatus>('upload');
	editCount = $state(0);
	originalImageUrl = $state('');
	isProcessing = $state(false);
	errorMessage = $state('');

	compareId = $state<string | null>(null);
	isComparing = $state(false);
	justLocked = $state(false);

	constructor(
		public data: {
			tableId: number;
			workspace?: {
				originalImageUrl: string;
				status: string;
				editCount: number;
				activeNodeId?: string | null;
			} | null;
			history?: Version[];
		},
		public basePath: string = `/table/${data.tableId}`
	) {
		const ws = data.workspace;
		if (ws) {
			this.status = ws.status === 'locked' ? 'locked' : 'preview';
			this.originalImageUrl = ws.originalImageUrl;
			this.editCount = ws.editCount;
			this.activeId = ws.activeNodeId ?? null;
			this.versions = data.history ?? [];
		}
	}

	readonly tree = $derived(buildTree(this.versions));
	readonly activeVersion = $derived(this.versions.find((v) => v.id === this.activeId));
	readonly currentImageUrl = $derived(this.activeVersion?.imageUrl ?? this.originalImageUrl);
	readonly currentStep = $derived(this.activeVersion?.step ?? 0);
	readonly compareImageUrl = $derived(
		this.compareId
			? (this.versions.find((v) => v.id === this.compareId)?.imageUrl ?? this.originalImageUrl)
			: this.activeVersion?.parentId
				? (this.versions.find((v) => v.id === this.activeVersion!.parentId)?.imageUrl ??
					this.originalImageUrl)
				: this.originalImageUrl
	);

	readonly hasReachedLimit = $derived(this.editCount >= MAX_EDITS_PER_TABLE);
	readonly editsRemaining = $derived(MAX_EDITS_PER_TABLE - this.editCount);

	async createWorkspace(imageUrl: string) {
		const res = await fetch('/api/workspace', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tableId: this.data.tableId, imageUrl })
		});

		if (!res.ok) throw new Error('Failed to create workspace');

		const { workspace } = await res.json();
		this.status = 'preview';
		this.originalImageUrl = workspace.originalImageUrl;
		this.editCount = 0;
		this.versions = [];
		this.activeId = null;
		pushState(this.basePath, {});
	}

	async generate(prompt: string, mask?: MaskData, mode?: 'add' | 'subtract' | 'modify', strength?: number) {
		const hasMask = !!(mask?.aiMaskUrl || mask?.rects?.length || mask?.paths?.length || mask?.polygons?.length);
		if ((!prompt.trim() && !hasMask) || this.isProcessing || this.hasReachedLimit) return;

		const effectivePrompt = prompt.trim() || 'Seamlessly fill this area to match the surrounding workspace';
		this.errorMessage = '';
		this.isProcessing = true;

		try {
			const result = await editImage({
				imageUrl: this.currentImageUrl,
				editPrompt: effectivePrompt,
				maskUrl: mask?.aiMaskUrl ?? undefined,
				assetUrl: mask?.assetUrl ?? undefined,
				tool: mask?.tool,
				mode,
				tableId: this.data.tableId,
				strength: strength ?? 0.75,
				sourceNodeId: this.activeId
			});

			const newVersion: Version = {
				id: result.nodeId,
				step: result.step,
				parentId: this.activeId,
				imageUrl: result.imageUrl,
				prompt: effectivePrompt,
				createdAt: new Date().toISOString() // eslint-disable-line svelte/prefer-svelte-reactivity
			};

			this.versions = [...this.versions, newVersion];
			this.activeId = newVersion.id;
			this.editCount = result.editCount;

			pushState(`${this.basePath}?node=${newVersion.id}`, { node: newVersion.id });
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Edit failed';
		} finally {
			this.isProcessing = false;
		}
	}

	activate(versionId: string | null) {
		this.activeId = versionId;
		if (versionId) {
			pushState(`${this.basePath}?node=${versionId}`, { node: versionId });
		} else {
			pushState(this.basePath, {});
		}
	}

	async delete(versionId: string) {
		if (this.isProcessing) return;
		if (!confirm('Delete this version?')) return;

		try {
			const { workspace } = await deleteImage({
				tableId: this.data.tableId,
				nodeId: versionId
			});

			const deletedParentId = this.versions.find((v) => v.id === versionId)?.parentId ?? null;
			this.versions = this.versions.filter((v) => v.id !== versionId);

			if (this.activeId === versionId) {
				this.activeId = deletedParentId;
			}

			if (this.compareId === versionId) {
				this.compareId = null;
			}

			this.editCount = workspace.editCount;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Delete failed';
		}
	}

	async lock() {
		if (this.isProcessing) return;

		try {
			await lockImage({
				tableId: this.data.tableId,
				imageUrl: this.currentImageUrl
			});
			this.status = 'locked';
			this.justLocked = true;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Lock failed';
		}
	}

	toggleComparison() {
		if (this.isComparing) {
			this.isComparing = false;
			this.compareId = null;
		} else {
			this.isComparing = true;
			this.compareId = this.activeVersion?.parentId ?? null;
		}
	}

	setCompareTarget(versionId: string | null) {
		this.compareId = versionId;
		this.isComparing = true;
	}
}
