import * as v from 'valibot';
import { command, getRequestEvent } from '$app/server';
import {
	createImageEditor,
	createImageSegmenter,
	generateGlb,
	resolveImageForFal
} from '$lib/server/ai/index';
import { persistImage, persistGlb } from '$lib/server/storage';
import { getSpace, addEditNode, deleteEditNode, updateSpace } from '$lib/server/db/queries';
import { BLOCKED_TERMS, MAX_FIELD_LENGTH } from '$lib/utils/edit-prompt';

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
		'Invalid URL'
	)
);

const safePrompt = v.pipe(
	v.string(),
	v.maxLength(MAX_FIELD_LENGTH),
	v.check(
		(text) => !BLOCKED_TERMS.some((term) => text.toLowerCase().includes(term)),
		'Prompt contains blocked content'
	)
);

const safeMaskUrl = v.optional(
	v.union([
		safeImageUrl,
		v.pipe(
			v.string(),
			v.check((s) => s.startsWith('data:image/'), 'Must be image data URI'),
			v.maxLength(5 * 1024 * 1024)
		)
	])
);

const EditImageSchema = v.object({
	spaceId: v.pipe(v.string(), v.nonEmpty()),
	prompt: safePrompt,
	maskUrl: safeMaskUrl,
	assetUrl: v.optional(safeImageUrl),
	tool: v.optional(v.picklist(['draw', 'brush', 'magic', 'poly'])),
	mode: v.optional(v.picklist(['add', 'subtract', 'modify'])),
	strength: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)))
});

export const editImage = command(EditImageSchema, async (data) => {
	const event = getRequestEvent();
	const sessionId = event?.cookies.get('session_id');
	if (!sessionId) throw new Error('Unauthorized');

	const space = await getSpace(data.spaceId);
	if (!space) throw new Error('Space not found');
	if (space.sessionId !== sessionId) throw new Error('Forbidden');

	const editor = createImageEditor();
	const result = await editor.edit({
		imageUrl: space.currentImageUrl,
		prompt: data.prompt,
		maskUrl: data.maskUrl,
		assetUrl: data.assetUrl,
		tool: data.tool,
		mode: data.mode,
		strength: data.strength
	});

	const persistedUrl = await persistImage(result.imageUrl);

	const { space: updatedSpace, node } = await addEditNode(
		data.spaceId,
		space.activeNodeId,
		persistedUrl,
		data.prompt
	);

	return {
		space: updatedSpace,
		node: {
			id: node.id,
			step: node.step,
			parentId: node.parentId,
			imageUrl: node.imageUrl,
			prompt: node.prompt,
			createdAt: node.createdAt
		}
	};
});

const SegmentSchema = v.object({
	imageUrl: safeImageUrl,
	points: v.array(v.tuple([v.number(), v.number()]))
});

export const segmentObject = command(SegmentSchema, async (data) => {
	const segmenter = createImageSegmenter();
	return segmenter.segment({
		imageUrl: data.imageUrl,
		points: data.points
	});
});

const DeleteImageSchema = v.object({
	spaceId: v.pipe(v.string(), v.nonEmpty()),
	nodeId: v.pipe(v.string(), v.nonEmpty())
});

export const deleteImage = command(DeleteImageSchema, async (data) => {
	const event = getRequestEvent();
	const sessionId = event?.cookies.get('session_id');
	if (!sessionId) throw new Error('Unauthorized');

	const space = await getSpace(data.spaceId);
	if (!space) throw new Error('Space not found');
	if (space.sessionId !== sessionId) throw new Error('Forbidden');

	const updatedSpace = await deleteEditNode(data.spaceId, data.nodeId);
	return { space: updatedSpace };
});

const CompleteSpaceSchema = v.object({
	spaceId: v.pipe(v.string(), v.nonEmpty())
});

export const completeSpace = command(CompleteSpaceSchema, async (data) => {
	const event = getRequestEvent();
	const sessionId = event?.cookies.get('session_id');
	if (!sessionId) throw new Error('Unauthorized');

	const space = await getSpace(data.spaceId);
	if (!space) throw new Error('Space not found');
	if (space.sessionId !== sessionId) throw new Error('Forbidden');

	if (space.status === 'complete') {
		return { space };
	}

	// Generate 3D model from workspace image (graceful degradation on failure)
	let glbUrl: string | null = null;
	try {
		const falImageUrl = await resolveImageForFal(space.currentImageUrl);
		const glbResult = await generateGlb({ imageUrl: falImageUrl });
		glbUrl = await persistGlb(glbResult.glbUrl);
	} catch {
		// GLB generation failed — space still completes, World shows room corner fallback
		console.warn(`GLB generation failed for space ${data.spaceId}, completing without 3D model`);
	}

	const updatedSpace = await updateSpace(data.spaceId, {
		status: 'complete',
		glbUrl
	});

	return { space: updatedSpace };
});
