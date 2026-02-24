import { json, error } from '@sveltejs/kit';
import { getSpace, updateSpace, getAllCompletedSpaces } from '$lib/server/db/queries';
import type { RequestHandler } from './$types';

/**
 * POST /api/iso
 *
 * Marks a space as complete for the 3D world view.
 * The world scene renders preset isometric room corners
 * with the workspace image as texture — no GLB generation needed.
 * Body: { spaceId: string }
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) return new Response('Unauthorized', { status: 401 });

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
	if (space.sessionId !== sessionId) return new Response('Forbidden', { status: 403 });
	if (space.status === 'complete') {
		return json({ spaceId: space.id, status: 'complete' });
	}

	const updated = await updateSpace(spaceId, { status: 'complete' });

	return json({ spaceId: updated?.id ?? spaceId, status: 'complete' });
};

/**
 * GET /api/iso
 *
 * Returns all completed spaces with their images.
 */
export const GET: RequestHandler = async () => {
	const items = await getAllCompletedSpaces();
	const models = items.map((s) => ({
		id: s.id,
		name: s.name,
		imageUrl: s.currentImageUrl
	}));

	return json({ models, count: models.length });
};
