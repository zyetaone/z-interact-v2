import * as v from 'valibot';
import { command, getRequestEvent } from '$app/server';
import {
	saveQuestChoice,
	createSpace,
	tryCompleteQuest,
	getSession,
	getSessionSpaces
} from '$lib/server/db/queries';
import { computeArchetype } from '$lib/config/archetypes';

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
});

export const saveQuest = command(SaveQuestSchema, async ({ choices }) => {
	const event = getRequestEvent();
	const sessionId = event?.cookies.get('session_id');
	if (!sessionId) throw new Error('Unauthorized');

	const session = await getSession(sessionId);
	if (!session) throw new Error('Session not found');

	// Compute archetype first (pure function, no DB)
	const archetype = computeArchetype(choices.map((c) => c.selected));

	// Atomic gate: only the first request to flip quest_completed wins
	const claimed = await tryCompleteQuest(sessionId, archetype.key);

	if (!claimed) {
		// Another request already completed the quest — return existing data
		const existingSpaces = await getSessionSpaces(sessionId);
		const existing = await getSession(sessionId);
		return {
			spaceIds: existingSpaces.map((s) => s.id),
			archetype: existing?.archetype ?? archetype.key
		};
	}

	// We won the race — create spaces
	const spaceIds: string[] = [];

	for (let i = 0; i < choices.length; i++) {
		const c = choices[i];
		await saveQuestChoice(sessionId, c.step, c.optionA, c.optionB, c.selected, c.tags);
		const space = await createSpace({
			sessionId,
			name: c.spaceName,
			originalImageUrl: c.imageUrl,
			currentImageUrl: c.imageUrl,
			status: 'quest',
			sortOrder: i
		});
		spaceIds.push(space.id);
	}

	return { spaceIds, archetype: archetype.key };
});
