import { eq, and, lt, asc, isNotNull, sql } from 'drizzle-orm';
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
	return db().insert(sessions).values(data ?? {}).returning().get();
}

export function getSession(id: string) {
	return db().query.sessions.findFirst({ where: eq(sessions.id, id) });
}

export function updateSession(
	id: string,
	data: Partial<Pick<NewSession, 'name' | 'questCompleted'>>
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
	return db()
		.select()
		.from(spaces)
		.where(and(eq(spaces.status, 'complete'), isNotNull(spaces.glbUrl)))
		.all();
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
	const now = new Date().toISOString();

	const space = await d
		.update(spaces)
		.set({
			currentImageUrl: newImageUrl,
			editCount: sql`${spaces.editCount} + 1`,
			status: 'forging',
			activeNodeId: nodeId,
			updatedAt: now
		})
		.where(and(eq(spaces.id, spaceId), lt(spaces.editCount, MAX_EDITS_PER_SPACE)))
		.returning()
		.get();

	if (!space) {
		const existing = await d.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
		if (!existing) throw new Error(`Space not found: ${spaceId}`);
		throw new Error(`Edit limit reached (${MAX_EDITS_PER_SPACE} max)`);
	}

	const node = await d
		.insert(editHistory)
		.values({
			id: nodeId,
			spaceId,
			step: space.editCount,
			parentId: parentNodeId,
			imageUrl: newImageUrl,
			prompt
		})
		.returning()
		.get();

	return { space, node };
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

	await d.delete(editHistory).where(eq(editHistory.id, nodeId)).run();

	return d
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
}
