import * as v from 'valibot';
import { command } from '$app/server';
import { saveQuestChoice, createSpace, updateSession, getSession } from '$lib/server/db/queries';

const SaveQuestSchema = v.object({
	sessionId: v.pipe(v.string(), v.nonEmpty()),
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

export const saveQuest = command(SaveQuestSchema, async ({ sessionId, choices }) => {
	const session = await getSession(sessionId);
	if (!session) throw new Error('Session not found');

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
