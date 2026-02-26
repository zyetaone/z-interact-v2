import * as v from 'valibot'
import { command, getRequestEvent } from '$app/server'
import { getDb } from '@zyeta/shared/db'
import {
	saveQuestChoice,
	createSpace,
	tryCompleteQuest,
	getSession,
	getSessionSpaces
} from '@zyeta/shared/db/queries'
import { computeArchetype } from '@zyeta/shared/config/archetypes'

const SaveQuestSchema = v.object({
	choices: v.array(
		v.object({
			step: v.number(),
			optionA: v.string(),
			optionB: v.string(),
			selected: v.union([v.literal('a'), v.literal('b')]),
			spaceName: v.string(),
			imageUrl: v.string(),
			tags: v.array(v.string())
		})
	)
})

export const saveQuest = command(SaveQuestSchema, async ({ choices }) => {
	const event = getRequestEvent()
	const sessionId = event?.cookies.get('session_id')
	if (!sessionId) throw new Error('Unauthorized')

	const db = getDb(event?.platform)
	const session = await getSession(db, sessionId)
	if (!session) throw new Error('Session not found')

	// Compute archetype first (pure function, no DB)
	const archetype = computeArchetype(choices.map((c) => c.selected))

	// Atomic gate: only the first request to flip quest_completed wins
	const claimed = await tryCompleteQuest(db, sessionId, archetype.key)

	if (!claimed) {
		// Another request already completed the quest — return existing data
		const existingSpaces = await getSessionSpaces(db, sessionId)
		const existing = await getSession(db, sessionId)
		return {
			spaceIds: existingSpaces.map((s: { id: string }) => s.id),
			archetype: existing?.archetype ?? archetype.key
		}
	}

	// We won the race — create spaces
	const spaceIds: string[] = []

	for (let i = 0; i < choices.length; i++) {
		const c = choices[i]
		await saveQuestChoice(db, sessionId, c.step, c.optionA, c.optionB, c.selected, c.tags)
		const space = await createSpace(db, {
			sessionId,
			name: c.spaceName,
			originalImageUrl: c.imageUrl,
			currentImageUrl: c.imageUrl,
			status: 'quest',
			sortOrder: i
		})
		spaceIds.push(space.id)
	}

	return { spaceIds, archetype: archetype.key }
})
