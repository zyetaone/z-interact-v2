import type { PageServerLoad } from './$types';
import { getDb } from '@zyeta/shared/db';
import { getSession, getSessionSpaces } from '@zyeta/shared/db/queries';

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) return { hasSession: false, questCompleted: false, archetype: null, spaces: [] };

	const db = getDb(platform);
	const session = await getSession(db, sessionId);
	if (!session) {
		// Stale cookie — session was deleted or DB was reset
		cookies.delete('session_id', { path: '/' });
		return { hasSession: false, questCompleted: false, archetype: null, spaces: [] };
	}
	const spaces = await getSessionSpaces(db, sessionId);
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
