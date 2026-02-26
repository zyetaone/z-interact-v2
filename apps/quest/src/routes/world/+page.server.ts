import type { PageServerLoad } from './$types'
import { getDb } from '@zyeta/shared/db'
import { getSession, getCompletedSpaces, getSessionSpaces } from '@zyeta/shared/db/queries'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const sessionId = cookies.get('session_id')
	if (!sessionId) redirect(302, '/?expired')

	const db = getDb(platform)
	const session = await getSession(db, sessionId)
	if (!session) {
		cookies.delete('session_id', { path: '/' })
		redirect(302, '/?expired')
	}

	const [completedSpaces, allSpaces] = await Promise.all([
		getCompletedSpaces(db, sessionId),
		getSessionSpaces(db, sessionId)
	])

	const allComplete = allSpaces.length > 0 && allSpaces.every((s) => s.status === 'complete')

	return {
		models: completedSpaces
			.filter((s) => s.status === 'complete')
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl,
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
	}
}
