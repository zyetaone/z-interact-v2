import type { PageServerLoad } from './$types'
import { getDb } from '@zyeta/shared/db'
import { createSession, getSession } from '@zyeta/shared/db/queries'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const db = getDb(platform)
	let sessionId = cookies.get('session_id')
	let session

	if (sessionId) {
		session = await getSession(db, sessionId)
	}

	// Quest already completed — send back to dashboard
	if (session?.questCompleted) {
		redirect(302, '/')
	}

	if (!session) {
		session = await createSession(db)
		sessionId = session.id
		cookies.set('session_id', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax' as const,
			maxAge: 60 * 60 * 24 * 30
		})
	}

	return { sessionId: sessionId! }
}
