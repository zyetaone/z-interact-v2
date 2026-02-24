import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getSpace, getEditHistory, getSessionSpaces } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) redirect(302, '/');

	const space = await getSpace(params.spaceId);
	if (!space) throw error(404, 'Space not found');
	if (space.sessionId !== sessionId) throw error(403, 'Not your space');

	const [history, allSpaces] = await Promise.all([
		getEditHistory(space.id),
		getSessionSpaces(sessionId)
	]);

	return {
		space,
		history: history.map((h) => ({
			id: h.id,
			step: h.step,
			parentId: h.parentId,
			imageUrl: h.imageUrl,
			prompt: h.prompt,
			createdAt: h.createdAt
		})),
		allSpaces: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			status: s.status,
			sortOrder: s.sortOrder
		}))
	};
};
