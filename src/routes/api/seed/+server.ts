import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSeedSession, createSpace, getSeedSessions } from '$lib/server/db/queries';

const SEED_SPACES = [
	{ name: 'Open Studio', image: '/assets/WS 01.jpg', archetype: 'collaborator' },
	{ name: 'Executive Suite', image: '/assets/PROJECT ROOM 01.jpg', archetype: 'architect' },
	{ name: 'Zen Focus Pod', image: '/assets/FOCUS RM 01.jpg', archetype: 'minimalist' },
	{ name: 'Creative Lounge', image: '/assets/LOUNGE 01.jpg', archetype: 'creator' },
	{ name: 'Strategy Room', image: '/assets/PROJECT ROOM 02.jpg', archetype: 'strategist' }
];

export const POST: RequestHandler = async ({ request, platform }) => {
	const seedKey = request.headers.get('X-Seed-Key');
	const expectedKey = platform?.env?.SEED_SECRET ?? process.env.SEED_SECRET;

	if (!expectedKey || seedKey !== expectedKey) {
		throw error(403, 'Invalid seed key');
	}

	// Check if seeds already exist
	const existing = await getSeedSessions();
	if (existing.length > 0) {
		return json({ message: 'Seeds already exist', count: existing.length });
	}

	const created: string[] = [];

	for (const seed of SEED_SPACES) {
		const session = await createSeedSession(seed.archetype);
		await createSpace({
			sessionId: session.id,
			name: seed.name,
			originalImageUrl: seed.image,
			currentImageUrl: seed.image,
			status: 'quest',
			sortOrder: 0
		});
		created.push(session.id);
	}

	return json({ message: 'Seed content created', count: created.length });
};
