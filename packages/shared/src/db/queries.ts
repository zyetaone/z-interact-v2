import { eq, and, lt, asc, sql } from 'drizzle-orm';
import type { DbClient } from './index';
import { sessions, questChoices, spaces, editHistory } from './schema';
import type { NewSession, NewSpace } from './schema';

const MAX_EDITS_PER_SPACE = 20;

// --- Sessions ---

export function createSession(db: DbClient, data?: Partial<NewSession>) {
	return db
		.insert(sessions)
		.values(data ?? {})
		.returning()
		.get();
}

export function getSession(db: DbClient, id: string) {
	return db.query.sessions.findFirst({ where: eq(sessions.id, id) });
}

export function updateSession(
	db: DbClient,
	id: string,
	data: Partial<Pick<NewSession, 'name' | 'questCompleted' | 'archetype'>>
) {
	return db
		.update(sessions)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(sessions.id, id))
		.returning()
		.get();
}

/**
 * Atomically mark quest as completed. Returns the updated session if this caller
 * won the race (quest_completed was false), or null if another request already completed it.
 */
export function tryCompleteQuest(db: DbClient, id: string, archetype: string) {
	return db
		.update(sessions)
		.set({ questCompleted: true, archetype, updatedAt: new Date().toISOString() })
		.where(and(eq(sessions.id, id), eq(sessions.questCompleted, false)))
		.returning()
		.get();
}

// --- Quest Choices ---

export function saveQuestChoice(
	db: DbClient,
	sessionId: string,
	step: number,
	optionA: string,
	optionB: string,
	selected: 'a' | 'b',
	tags: string[]
) {
	return db
		.insert(questChoices)
		.values({
			sessionId,
			step,
			optionA,
			optionB,
			selected,
			tags: JSON.stringify(tags)
		})
		.returning()
		.get();
}

export function getQuestChoices(db: DbClient, sessionId: string) {
	return db
		.select()
		.from(questChoices)
		.where(eq(questChoices.sessionId, sessionId))
		.orderBy(asc(questChoices.step))
		.all();
}

// --- Spaces ---

export function createSpace(db: DbClient, data: NewSpace) {
	return db.insert(spaces).values(data).returning().get();
}

export function getSpace(db: DbClient, id: string) {
	return db.query.spaces.findFirst({ where: eq(spaces.id, id) });
}

export function getSessionSpaces(db: DbClient, sessionId: string) {
	return db
		.select()
		.from(spaces)
		.where(eq(spaces.sessionId, sessionId))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function updateSpace(
	db: DbClient,
	id: string,
	data: Partial<
		Pick<
			NewSpace,
			'currentImageUrl' | 'editCount' | 'status' | 'activeNodeId' | 'name' | 'modelUrl'
		>
	>
) {
	return db
		.update(spaces)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(spaces.id, id))
		.returning()
		.get();
}

/**
 * Atomically mark space as completed. Returns the updated space if this caller
 * won the race (status was 'forging'), or null if already completed.
 */
export function tryCompleteSpace(db: DbClient, id: string) {
	return db
		.update(spaces)
		.set({ status: 'complete', updatedAt: new Date().toISOString() })
		.where(and(eq(spaces.id, id), eq(spaces.status, 'forging')))
		.returning()
		.get();
}

export function getCompletedSpaces(db: DbClient, sessionId: string) {
	return db
		.select()
		.from(spaces)
		.where(and(eq(spaces.sessionId, sessionId), eq(spaces.status, 'complete')))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function getAllCompletedSpaces(db: DbClient) {
	return db.select().from(spaces).where(eq(spaces.status, 'complete')).all();
}

export async function reorderSpaces(
	db: DbClient,
	sessionId: string,
	order: { id: string; sortOrder: number }[]
) {
	for (const item of order) {
		await db
			.update(spaces)
			.set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
			.where(and(eq(spaces.id, item.id), eq(spaces.sessionId, sessionId)))
			.run();
	}
}

// --- Edit History (Forge) ---

export async function addEditNode(
	db: DbClient,
	spaceId: string,
	parentNodeId: string | null,
	newImageUrl: string,
	prompt: string
) {
	const nodeId = crypto.randomUUID();

	// 1. Insert edit node first (orphaned nodes are harmless; a space pointing to
	//    a non-existent node is not). Step is set to 0 temporarily.
	const node = await db
		.insert(editHistory)
		.values({
			id: nodeId,
			spaceId,
			step: 0,
			parentId: parentNodeId,
			imageUrl: newImageUrl,
			prompt
		})
		.returning()
		.get();

	// 2. Try to update the space — the WHERE guard enforces the edit limit atomically.
	try {
		const space = await db
			.update(spaces)
			.set({
				currentImageUrl: newImageUrl,
				editCount: sql`${spaces.editCount} + 1`,
				status: 'forging',
				activeNodeId: nodeId,
				updatedAt: new Date().toISOString()
			})
			.where(and(eq(spaces.id, spaceId), lt(spaces.editCount, MAX_EDITS_PER_SPACE)))
			.returning()
			.get();

		if (!space) {
			throw new Error('Edit limit reached — maximum edits per space exceeded');
		}

		// 3. Now set the correct step on the node (matches the incremented editCount).
		const [updatedNode] = await db
			.update(editHistory)
			.set({ step: space.editCount })
			.where(eq(editHistory.id, nodeId))
			.returning();

		return { space, node: updatedNode ?? node };
	} catch (e) {
		// Rollback orphaned node on unexpected error
		await db
			.delete(editHistory)
			.where(eq(editHistory.id, nodeId))
			.run()
			.catch((rollbackErr) => {
				console.error('Failed to rollback orphaned edit node', nodeId, rollbackErr);
			});
		throw e;
	}
}

export function getEditHistory(db: DbClient, spaceId: string) {
	return db
		.select()
		.from(editHistory)
		.where(eq(editHistory.spaceId, spaceId))
		.orderBy(asc(editHistory.step))
		.all();
}

export async function deleteEditNode(db: DbClient, spaceId: string, nodeId: string) {
	// 1. Validate preconditions (parallel reads)
	const [children, node, sp] = await Promise.all([
		db.select().from(editHistory).where(eq(editHistory.parentId, nodeId)).all(),
		db.select().from(editHistory).where(eq(editHistory.id, nodeId)).get(),
		db.select().from(spaces).where(eq(spaces.id, spaceId)).get()
	]);

	if (children.length > 0) throw new Error('Cannot delete a node with children');
	if (!node) throw new Error('Edit node not found');
	if (!sp) throw new Error('Space not found');

	const newActiveNodeId = sp.activeNodeId === nodeId ? (node.parentId ?? null) : sp.activeNodeId;

	let newImageUrl = sp.originalImageUrl;
	if (newActiveNodeId) {
		const activeNode = await db
			.select()
			.from(editHistory)
			.where(eq(editHistory.id, newActiveNodeId))
			.get();
		if (activeNode) newImageUrl = activeNode.imageUrl;
	}

	// 2. Delete the node first (a missing history node is less harmful than a
	//    space pointing to a non-existent node)
	await db.delete(editHistory).where(eq(editHistory.id, nodeId)).run();

	// 3. Update the space — if this fails, re-insert the deleted node to restore consistency
	try {
		const space = await db
			.update(spaces)
			.set({
				activeNodeId: newActiveNodeId,
				currentImageUrl: newImageUrl,
				editCount: sql`MAX(${spaces.editCount} - 1, 0)`,
				updatedAt: new Date().toISOString()
			})
			.where(eq(spaces.id, spaceId))
			.returning()
			.get();

		if (!space) {
			throw new Error(`Failed to update space: ${spaceId}`);
		}

		return space;
	} catch (e) {
		// Rollback: re-insert the deleted node
		await db
			.insert(editHistory)
			.values({
				id: node.id,
				spaceId: node.spaceId,
				step: node.step,
				parentId: node.parentId,
				imageUrl: node.imageUrl,
				prompt: node.prompt
			})
			.run()
			.catch((rollbackErr) => {
				console.error('Failed to rollback deleted edit node', node.id, rollbackErr);
			});
		throw e;
	}
}

// --- Seed Content ---

export function createSeedSession(db: DbClient, archetype: string) {
	return db
		.insert(sessions)
		.values({
			name: 'Seed Explorer',
			questCompleted: true,
			archetype,
			isSeed: true
		})
		.returning()
		.get();
}

export function getSeedSessions(db: DbClient) {
	return db.select().from(sessions).where(eq(sessions.isSeed, true)).all();
}
