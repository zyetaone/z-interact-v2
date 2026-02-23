import { json, error } from '@sveltejs/kit';
import { generateGlb } from '$lib/server/ai';
import { resolveImageForFal } from '$lib/server/ai/fal-config';
import { getSpace, updateSpace, getAllCompletedSpaces } from '$lib/server/db/queries';
import { persistGlb } from '$lib/server/storage';
import type { RequestHandler } from './$types';

/**
 * POST /api/iso
 *
 * Generates a 3D GLB model from a space image using Trellis-2,
 * persists the GLB to R2, and updates the space record.
 * Body: { spaceId: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { spaceId } = body as { spaceId?: string };

	if (!spaceId || typeof spaceId !== 'string') {
		error(400, 'Invalid spaceId');
	}

	const space = await getSpace(spaceId);
	if (!space) {
		error(404, `Space not found: ${spaceId}`);
	}
	if (space.glbUrl) {
		return json({ glbUrl: space.glbUrl, cached: true });
	}

	const imageUrl = await resolveImageForFal(space.currentImageUrl);

	try {
		const { glbUrl: tempGlbUrl } = await generateGlb({ imageUrl });
		const permanentGlbUrl = await persistGlb(tempGlbUrl);
		const updated = await updateSpace(spaceId, { glbUrl: permanentGlbUrl, status: 'complete' });

		return json({ glbUrl: updated?.glbUrl ?? permanentGlbUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : '3D generation failed';
		error(500, message);
	}
};

/**
 * GET /api/iso
 *
 * Returns all completed spaces that have a GLB model URL.
 */
export const GET: RequestHandler = async () => {
	const items = await getAllCompletedSpaces();
	const models = items.map((s) => ({
		id: s.id,
		name: s.name,
		imageUrl: s.currentImageUrl,
		glbUrl: s.glbUrl
	}));

	return json({ models, count: models.length });
};
