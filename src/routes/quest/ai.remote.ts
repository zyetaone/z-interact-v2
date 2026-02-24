import * as v from 'valibot';
import { command, getRequestEvent } from '$app/server';
import {
	saveQuestChoice,
	createSpace,
	updateSession,
	getSession,
	getSessionSpaces
} from '$lib/server/db/queries';

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

	if (session.questCompleted) {
		const existingSpaces = await getSessionSpaces(sessionId);
		return { spaceIds: existingSpaces.map((s) => s.id) };
	}

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

	await updateSession(sessionId, { questCompleted: true });

	return { spaceIds };
});
