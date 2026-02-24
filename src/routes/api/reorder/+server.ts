import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderSpaces } from '$lib/server/db/queries';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) throw error(401, 'Unauthorized');

	const { order } = await request.json();
	if (!Array.isArray(order)) throw error(400, 'order must be an array');

	// Validate shape
	for (const item of order) {
		if (typeof item.id !== 'string' || typeof item.sortOrder !== 'number') {
			throw error(400, 'Each item must have id (string) and sortOrder (number)');
		}
	}

	await reorderSpaces(sessionId, order);
	return json({ ok: true });
};
