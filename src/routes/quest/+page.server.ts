import type { PageServerLoad } from './$types';
import { createSession, getSession } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ cookies }) => {
	let sessionId = cookies.get('session_id');
	let session;

	if (sessionId) {
		session = await getSession(sessionId);
	}

	if (!session) {
		session = await createSession();
		sessionId = session.id;
		cookies.set('session_id', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax' as const,
			maxAge: 60 * 60 * 24 * 30
		});
	}

	return { sessionId: sessionId! };
};
