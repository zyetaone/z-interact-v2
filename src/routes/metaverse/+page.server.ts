import type { PageServerLoad } from './$types';
import { getAllCompletedSpaces, getSession } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session_id');
	const session = sessionId ? await getSession(sessionId) : null;
	const allSpaces = await getAllCompletedSpaces();

	const uniqueSessions = new Set(allSpaces.map((s) => s.sessionId));

	return {
		models: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			imageUrl: s.currentImageUrl,
			editCount: s.editCount
		})),
		participantCount: uniqueSessions.size,
		hasSession: !!session
	};
};
