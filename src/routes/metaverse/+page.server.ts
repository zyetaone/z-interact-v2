import type { PageServerLoad } from './$types';
import { getAllCompletedSpaces } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const allSpaces = await getAllCompletedSpaces();

	const uniqueSessions = new Set(allSpaces.map((s) => s.sessionId));

	return {
		models: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			imageUrl: s.currentImageUrl,
			editCount: s.editCount
		})),
		participantCount: uniqueSessions.size
	};
};
