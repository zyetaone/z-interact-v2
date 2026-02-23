import * as v from 'valibot';
import { command } from '$app/server';
import { createImageEditor, createImageSegmenter } from '$lib/server/ai';
import { TABLE_COUNT, MAX_EDITS_PER_TABLE } from '$lib/config/tables';
import { BLOCKED_TERMS } from '$lib/utils/edit-prompt';
import { persistImage } from '$lib/server/storage';
import { addEditNode, updateWorkspace, getWorkspace, deleteEditNode } from '$lib/server/db/queries';

// Only allow local upload/asset paths or HTTPS URLs (blocks file://, javascript://, SSRF)
const safeImageUrl = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.check((url) => !url.includes('..'), 'Path traversal not allowed'),
	v.check(
		(url) =>
			url.startsWith('/uploads/') ||
			url.startsWith('/assets/') ||
			url.startsWith('/api/r2/') ||
			url.startsWith('https://'),
		'Image URL must be a local upload/asset path or HTTPS URL'
	)
);

// Like safeImageUrl but also allows data:image/ URIs (for canvas-generated masks)
const safeMediaUrl = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.check((url) => !url.includes('..'), 'Path traversal not allowed'),
	v.check(
		(url) =>
			url.startsWith('data:image/') ||
			url.startsWith('/uploads/') ||
			url.startsWith('/assets/') ||
			url.startsWith('/api/r2/') ||
			url.startsWith('https://'),
		'URL must be a data:image/ URI, local path, or HTTPS URL'
	)
);

const EditImageSchema = v.object({
	imageUrl: safeImageUrl,
	editPrompt: v.pipe(v.string(), v.nonEmpty(), v.maxLength(500)),
	maskUrl: v.optional(safeMediaUrl),
	assetUrl: v.optional(safeImageUrl),
	tool: v.optional(
		v.union([v.literal('draw'), v.literal('brush'), v.literal('magic'), v.literal('poly')])
	),
	mode: v.optional(
		v.union([v.literal('add'), v.literal('subtract'), v.literal('modify')])
	),
	tableId: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(TABLE_COUNT)),
	strength: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
	sourceNodeId: v.optional(v.nullable(v.string()))
});

export const editImage = command(
	EditImageSchema,
	async ({ imageUrl, editPrompt, maskUrl, assetUrl, tool, mode, tableId, strength, sourceNodeId }) => {
		// Server-side edit limit + lock check
		const workspace = await getWorkspace(tableId);
		if (!workspace) throw new Error('Workspace not found');
		if (workspace.status === 'locked') throw new Error('Workspace is locked');
		if (workspace.editCount >= MAX_EDITS_PER_TABLE) {
			throw new Error(`Edit limit reached (${MAX_EDITS_PER_TABLE} max)`);
		}

		// Server-side content filter with Unicode normalization (prevents homoglyph bypass)
		const promptNormalized = editPrompt
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		for (const term of BLOCKED_TERMS) {
			if (promptNormalized.includes(term)) {
				throw new Error('Prompt contains inappropriate content');
			}
		}

		const editor = createImageEditor();

		// Prompt logic is now centralized in fal-editor.ts
		const result = await editor.edit({
			imageUrl,
			maskUrl,
			assetUrl,
			tool,
			mode,
			prompt: editPrompt,
			strength: strength ?? 0.75
		});

		const permanentUrl = await persistImage(result.imageUrl);
		const { workspace: updatedWorkspace, node } = await addEditNode(
			tableId,
			sourceNodeId ?? null,
			permanentUrl,
			editPrompt
		);

		return {
			imageUrl: permanentUrl,
			editCount: updatedWorkspace.editCount,
			nodeId: node.id,
			step: node.step
		};
	}
);

export const segmentObject = command(
	v.object({
		imageUrl: safeImageUrl,
		points: v.array(v.tuple([v.number(), v.number()]))
	}),
	async ({ imageUrl, points }) => {
		const segmenter = createImageSegmenter();
		const result = await segmenter.segment({ imageUrl, points });
		return { maskUrl: result.maskUrl };
	}
);

export const deleteImage = command(
	v.object({
		tableId: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(TABLE_COUNT)),
		nodeId: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ tableId, nodeId }) => {
		const ws = await getWorkspace(tableId);
		if (!ws) throw new Error('Workspace not found');
		if (ws.status === 'locked') throw new Error('Cannot delete from a locked workspace');

		const workspace = await deleteEditNode(tableId, nodeId);
		return { workspace };
	}
);

const LockImageSchema = v.object({
	tableId: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(TABLE_COUNT)),
	imageUrl: safeImageUrl
});

export const lockImage = command(LockImageSchema, async ({ tableId, imageUrl }) => {
	const existing = await getWorkspace(tableId);
	if (!existing) throw new Error('Workspace not found');
	if (existing.status === 'locked') throw new Error('Workspace is already locked');

	const permanentUrl = await persistImage(imageUrl);
	const workspace = await updateWorkspace(tableId, {
		currentImageUrl: permanentUrl,
		status: 'locked'
	});
	return { workspace };
});
