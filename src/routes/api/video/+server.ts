import { json, error } from '@sveltejs/kit';
import { generateVideoClip } from '$lib/server/ai';
import { resolveImageForFal } from '$lib/server/ai/fal-config';
import { getAllWorkspaces } from '$lib/server/db/queries';
import type { RequestHandler } from './$types';

/**
 * POST /api/video
 *
 * Generates a video clip for a single workspace image.
 * Body: { imageUrl: string, index?: number }
 *
 * The client orchestrates: fetches locked workspaces, calls this endpoint
 * once per image, collects video URLs.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { imageUrl, index } = body as { imageUrl?: string; index?: number };

	if (!imageUrl || typeof imageUrl !== 'string') {
		error(400, 'Missing required field: imageUrl');
	}

	if (!imageUrl.startsWith('https://') && !imageUrl.startsWith('/api/r2/')) {
		error(400, 'Invalid imageUrl: must be HTTPS or local R2 path');
	}

	// Resolve local R2 paths to fal.ai-accessible URLs
	const resolvedUrl = await resolveImageForFal(imageUrl);

	try {
		const result = await generateVideoClip(
			{ imageUrl: resolvedUrl },
			typeof index === 'number' ? index : 0
		);
		return json({ videoUrl: result.videoUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Video generation failed';
		error(500, message);
	}
};

/**
 * GET /api/video
 *
 * Returns all locked workspace image URLs ready for video generation.
 */
export const GET: RequestHandler = async () => {
	const workspaces = await getAllWorkspaces();
	const locked = workspaces
		.filter((w) => w.status === 'locked' && w.currentImageUrl)
		.sort((a, b) => a.tableId - b.tableId)
		.map((w) => ({
			tableId: w.tableId,
			imageUrl: w.currentImageUrl
		}));

	return json({ images: locked, count: locked.length });
};
