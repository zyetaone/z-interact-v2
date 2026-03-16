import type { PageServerLoad } from './$types';
import { getDb } from '@zyeta/shared/db';
import { getSession, getSessionSpaces } from '@zyeta/shared/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) redirect(302, '/?expired');

	const db = getDb(platform);
	const session = await getSession(db, sessionId);
	if (!session) {
		cookies.delete('session_id', { path: '/' });
		redirect(302, '/?expired');
	}

	if (!session.questCompleted) {
		redirect(302, '/quest');
	}

	const allSpaces = await getSessionSpaces(db, sessionId);

	return {
		rooms: allSpaces
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl,
				modelUrl: s.modelUrl,
				editCount: s.editCount,
				sortOrder: s.sortOrder
			}))
			.sort((a, b) => a.sortOrder - b.sortOrder),
		sessionName: session.name ?? 'Explorer'
	};
};
