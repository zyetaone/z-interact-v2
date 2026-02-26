import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '@zyeta/shared/db'
import { reorderSpaces } from '@zyeta/shared/db/queries'

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const sessionId = cookies.get('session_id')
	if (!sessionId) throw error(401, 'Unauthorized')

	let body: unknown
	try {
		body = await request.json()
	} catch {
		throw error(400, 'Invalid JSON body')
	}
	const { order } = body as { order?: unknown }
	if (!Array.isArray(order)) throw error(400, 'order must be an array')

	// Validate shape
	for (const item of order) {
		if (typeof item.id !== 'string' || typeof item.sortOrder !== 'number') {
			throw error(400, 'Each item must have id (string) and sortOrder (number)')
		}
	}

	const db = getDb(platform)
	await reorderSpaces(db, sessionId, order)
	return json({ ok: true })
}
