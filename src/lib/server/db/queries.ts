import { eq, and, lt, asc, sql } from 'drizzle-orm';
import { getDb } from './index';
import { getRequestEvent } from '$app/server';
import { sessions, questChoices, spaces, editHistory } from './schema';
import type { NewSession, NewSpace } from './schema';

const MAX_EDITS_PER_SPACE = 20;

function db() {
	return getDb(getRequestEvent()?.platform);
}

// --- Sessions ---

export function createSession(data?: Partial<NewSession>) {
	return db()
		.insert(sessions)
		.values(data ?? {})
		.returning()
		.get();
}

export function getSession(id: string) {
	return db().query.sessions.findFirst({ where: eq(sessions.id, id) });
}

export function updateSession(
	id: string,
	data: Partial<Pick<NewSession, 'name' | 'questCompleted' | 'archetype'>>
) {
	return db()
		.update(sessions)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(sessions.id, id))
		.returning()
		.get();
}

// --- Quest Choices ---

export function saveQuestChoice(
	sessionId: string,
	step: number,
	optionA: string,
	optionB: string,
	selected: 'a' | 'b',
	tags: string[]
) {
	return db()
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

export function getQuestChoices(sessionId: string) {
	return db()
		.select()
		.from(questChoices)
		.where(eq(questChoices.sessionId, sessionId))
		.orderBy(asc(questChoices.step))
		.all();
}

// --- Spaces ---

export function createSpace(data: NewSpace) {
	return db().insert(spaces).values(data).returning().get();
}

export function getSpace(id: string) {
	return db().query.spaces.findFirst({ where: eq(spaces.id, id) });
}

export function getSessionSpaces(sessionId: string) {
	return db()
		.select()
		.from(spaces)
		.where(eq(spaces.sessionId, sessionId))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function updateSpace(
	id: string,
	data: Partial<
		Pick<NewSpace, 'currentImageUrl' | 'editCount' | 'status' | 'activeNodeId' | 'glbUrl' | 'name'>
	>
) {
	return db()
		.update(spaces)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(spaces.id, id))
		.returning()
		.get();
}

export function getCompletedSpaces(sessionId: string) {
	return db()
		.select()
		.from(spaces)
		.where(and(eq(spaces.sessionId, sessionId), eq(spaces.status, 'complete')))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function getAllCompletedSpaces() {
	return db().select().from(spaces).where(eq(spaces.status, 'complete')).all();
}

export async function reorderSpaces(sessionId: string, order: { id: string; sortOrder: number }[]) {
	const d = db();
	for (const item of order) {
		await d
			.update(spaces)
			.set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
			.where(and(eq(spaces.id, item.id), eq(spaces.sessionId, sessionId)))
			.run();
	}
}

// --- Edit History (Forge) ---

export async function addEditNode(
	spaceId: string,
	parentNodeId: string | null,
	newImageUrl: string,
	prompt: string
) {
	const d = db();
	const nodeId = crypto.randomUUID();

	// 1. Insert edit node first (orphaned nodes are harmless; a space pointing to
	//    a non-existent node is not). Step is set to 0 temporarily.
	const node = await d
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
		const space = await d
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
			// Rollback: delete the orphaned node
			await d.delete(editHistory).where(eq(editHistory.id, nodeId)).run();
			// Check why it failed
			const existing = await d.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
			if (!existing) throw new Error(`Space not found: ${spaceId}`);
			throw new Error(`Edit limit reached (${MAX_EDITS_PER_SPACE} max)`);
		}

		// 3. Now set the correct step on the node (matches the incremented editCount).
		const [updatedNode] = await d
			.update(editHistory)
			.set({ step: space.editCount })
			.where(eq(editHistory.id, nodeId))
			.returning();

		return { space, node: updatedNode ?? node };
	} catch (e) {
		// If it's our own thrown error, rethrow as-is
		if (
			e instanceof Error &&
			(e.message.includes('Edit limit') || e.message.includes('Space not found'))
		) {
			throw e;
		}
		// Rollback orphaned node on unexpected error
		await d
			.delete(editHistory)
			.where(eq(editHistory.id, nodeId))
			.run()
			.catch(() => {});
		throw e;
	}
}

export function getEditHistory(spaceId: string) {
	return db()
		.select()
		.from(editHistory)
		.where(eq(editHistory.spaceId, spaceId))
		.orderBy(asc(editHistory.step))
		.all();
}

export async function deleteEditNode(spaceId: string, nodeId: string) {
	const d = db();

	// 1. Validate preconditions (parallel reads)
	const [children, node, sp] = await Promise.all([
		d.select().from(editHistory).where(eq(editHistory.parentId, nodeId)).all(),
		d.select().from(editHistory).where(eq(editHistory.id, nodeId)).get(),
		d.select().from(spaces).where(eq(spaces.id, spaceId)).get()
	]);

	if (children.length > 0) throw new Error('Cannot delete a node with children');
	if (!node) throw new Error('Edit node not found');
	if (!sp) throw new Error('Space not found');

	const newActiveNodeId = sp.activeNodeId === nodeId ? (node.parentId ?? null) : sp.activeNodeId;

	let newImageUrl = sp.originalImageUrl;
	if (newActiveNodeId) {
		const activeNode = await d
			.select()
			.from(editHistory)
			.where(eq(editHistory.id, newActiveNodeId))
			.get();
		if (activeNode) newImageUrl = activeNode.imageUrl;
	}

	// 2. Delete the node first (a missing history node is less harmful than a
	//    space pointing to a non-existent node)
	await d.delete(editHistory).where(eq(editHistory.id, nodeId)).run();

	// 3. Update the space — if this fails, re-insert the deleted node to restore consistency
	try {
		const space = await d
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

		return space;
	} catch (e) {
		// Rollback: re-insert the deleted node
		await d
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
			.catch(() => {});
		throw e;
	}
}

// --- Seed Content ---

export function createSeedSession(archetype: string) {
	return db()
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

export function getSeedSessions() {
	return db().select().from(sessions).where(eq(sessions.isSeed, true)).all();
}
