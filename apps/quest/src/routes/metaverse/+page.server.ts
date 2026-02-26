import type { PageServerLoad } from './$types'
import { getDb } from '@zyeta/shared/db'
import { getAllCompletedSpaces, getSession } from '@zyeta/shared/db/queries'

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const db = getDb(platform)
	const sessionId = cookies.get('session_id')
	const session = sessionId ? await getSession(db, sessionId) : null
	const allSpaces = await getAllCompletedSpaces(db)

	const uniqueSessions = new Set(allSpaces.map((s) => s.sessionId))

	return {
		models: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			imageUrl: s.currentImageUrl,
			editCount: s.editCount
		})),
		participantCount: uniqueSessions.size,
		hasSession: !!session
	}
}
