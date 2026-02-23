import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const VALID_KEY =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|glb)$/i;

export const GET: RequestHandler = async ({ params, platform }) => {
	const r2 = platform?.env?.R2_IMAGES;
	if (!r2) error(500, 'R2 not configured');

	const key = params.key;
	if (!key || key.includes('..') || !VALID_KEY.test(key)) {
		error(400, 'Invalid key');
	}

	const object = await r2.get(key);
	if (!object) error(404, 'Not found');

	const body = await object.arrayBuffer();
	return new Response(body, {
		headers: {
			'content-type': object.httpMetadata?.contentType || 'image/png',
			'cache-control': object.httpMetadata?.cacheControl || 'public, max-age=31536000'
		}
	});
};
