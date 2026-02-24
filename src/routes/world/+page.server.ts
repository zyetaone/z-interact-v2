import type { PageServerLoad } from './$types';
import { getSession, getCompletedSpaces, getSessionSpaces } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) throw error(401, 'Start a quest first');
	const session = await getSession(sessionId);
	if (!session) throw error(401, 'Session not found');

	const [completedSpaces, allSpaces] = await Promise.all([
		getCompletedSpaces(sessionId),
		getSessionSpaces(sessionId)
	]);

	const allComplete = allSpaces.length > 0 && allSpaces.every((s) => s.status === 'complete');

	return {
		models: completedSpaces
			.filter((s) => s.status === 'complete')
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl,
				glbUrl: s.glbUrl ?? undefined,
				editCount: s.editCount,
				sortOrder: s.sortOrder
			}))
			.sort((a, b) => a.sortOrder - b.sortOrder),
		pending: allSpaces
			.filter((s) => s.status !== 'complete')
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl
			})),
		allComplete,
		totalSpaces: allSpaces.length
	};
};
