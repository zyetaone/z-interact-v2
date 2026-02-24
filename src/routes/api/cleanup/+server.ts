import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { sessions, questChoices, spaces, editHistory } from '$lib/server/db/schema';
import { lt, inArray } from 'drizzle-orm';

/**
 * POST /api/cleanup
 * Remove sessions older than `maxAgeDays` (default 7) and all their related data.
 * Protected by a simple bearer token from env (CLEANUP_SECRET).
 */
export const POST: RequestHandler = async ({ platform, request }) => {
	const secret = platform?.env?.CLEANUP_SECRET ?? process.env.CLEANUP_SECRET;
	if (!secret) return new Response('Cleanup not configured', { status: 501 });

	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${secret}`) {
		return new Response('Unauthorized', { status: 401 });
	}

	const url = new URL(request.url);
	const maxAgeDays = parseInt(url.searchParams.get('days') ?? '7', 10);
	const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();

	const db = getDb(platform);

	// Find stale sessions (non-seed only)
	const stale = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(lt(sessions.updatedAt, cutoff))
		.all();

	const staleIds = stale.filter(Boolean).map((s) => s.id);
	if (staleIds.length === 0) {
		return Response.json({ deleted: 0 });
	}

	// Find spaces belonging to stale sessions
	const staleSpaces = await db
		.select({ id: spaces.id })
		.from(spaces)
		.where(inArray(spaces.sessionId, staleIds))
		.all();
	const spaceIds = staleSpaces.map((s) => s.id);

	// Delete in dependency order: edit_history → spaces → quest_choices → sessions
	if (spaceIds.length > 0) {
		await db.delete(editHistory).where(inArray(editHistory.spaceId, spaceIds)).run();
		await db.delete(spaces).where(inArray(spaces.id, spaceIds)).run();
	}
	await db.delete(questChoices).where(inArray(questChoices.sessionId, staleIds)).run();
	await db.delete(sessions).where(inArray(sessions.id, staleIds)).run();

	return Response.json({ deleted: staleIds.length });
};
