import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSpace, getEditHistory } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) throw error(401, 'No session');

	const space = await getSpace(params.spaceId);
	if (!space) throw error(404, 'Space not found');
	if (space.sessionId !== sessionId) throw error(403, 'Not your space');

	const history = await getEditHistory(space.id);

	return {
		space,
		history: history.map((h) => ({
			id: h.id,
			step: h.step,
			parentId: h.parentId,
			imageUrl: h.imageUrl,
			prompt: h.prompt,
			createdAt: h.createdAt
		}))
	};
};
