import type { PageServerLoad } from './$types';
import { getSession, getSessionSpaces } from '@zyeta/shared/db/queries';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) return { hasSession: false, questCompleted: false, archetype: null, spaces: [] };
	const session = await getSession(sessionId);
	if (!session) {
		// Stale cookie — session was deleted or DB was reset
		cookies.delete('session_id', { path: '/' });
		return { hasSession: false, questCompleted: false, archetype: null, spaces: [] };
	}
	const spaces = await getSessionSpaces(sessionId);
	return {
		hasSession: true,
		questCompleted: session.questCompleted,
		archetype: session.archetype ?? null,
		spaces: spaces.map((s) => ({
			id: s.id,
			name: s.name,
			status: s.status,
			imageUrl: s.currentImageUrl
		}))
	};
};
