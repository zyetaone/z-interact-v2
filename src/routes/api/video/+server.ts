import { json, error } from '@sveltejs/kit';
import { generateVideoClip } from '$lib/server/ai';
import { resolveImageForFal } from '$lib/server/ai/fal-config';
import type { RequestHandler } from './$types';

/**
 * POST /api/video
 *
 * Generates a video clip from an image URL.
 * Body: { imageUrl: string, index?: number }
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
