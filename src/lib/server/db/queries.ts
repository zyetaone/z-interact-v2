import { eq, sql, asc, and, lt, isNotNull } from 'drizzle-orm';
import { getDb } from './index';
import { getRequestEvent } from '$app/server';
import { workspaces, editHistory, type NewWorkspace } from './schema';
import { MAX_EDITS_PER_TABLE } from '$lib/config/tables';

function db() {
	return getDb(getRequestEvent()?.platform);
}

export function getWorkspace(tableId: number) {
	return db().query.workspaces.findFirst({
		where: eq(workspaces.tableId, tableId)
	});
}

export function createWorkspace(data: NewWorkspace) {
	return db().insert(workspaces).values(data).returning().get();
}

export function updateWorkspace(
	tableId: number,
	data: Partial<
		Pick<
			NewWorkspace,
			'originalImageUrl' | 'currentImageUrl' | 'editCount' | 'status' | 'activeNodeId'
		>
	>
) {
	return db()
		.update(workspaces)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(workspaces.tableId, tableId))
		.returning()
		.get();
}

export async function addEditNode(
	tableId: number,
	parentNodeId: string | null,
	newImageUrl: string,
	prompt: string
) {
	const d = db();
	const nodeId = crypto.randomUUID();
	const now = new Date().toISOString();

	// Atomic UPDATE with edit limit guard — prevents race conditions where
	// concurrent requests could exceed MAX_EDITS_PER_TABLE
	const workspace = await d
		.update(workspaces)
		.set({
			currentImageUrl: newImageUrl,
			editCount: sql`${workspaces.editCount} + 1`,
			status: 'editing',
			activeNodeId: nodeId,
			updatedAt: now
		})
		.where(and(eq(workspaces.tableId, tableId), lt(workspaces.editCount, MAX_EDITS_PER_TABLE)))
		.returning()
		.get();

	if (!workspace) {
		// Distinguish between "not found" and "limit reached"
		const existing = await d.query.workspaces.findFirst({
			where: eq(workspaces.tableId, tableId)
		});
		if (!existing) throw new Error(`Workspace not found for tableId: ${tableId}`);
		throw new Error(`Edit limit reached (${MAX_EDITS_PER_TABLE} max)`);
	}

	const node = await d
		.insert(editHistory)
		.values({
			id: nodeId,
			tableId,
			step: workspace.editCount,
			parentId: parentNodeId,
			imageUrl: newImageUrl,
			prompt
		})
		.returning()
		.get();

	return { workspace, node };
}

export function getEditHistory(tableId: number) {
	return db()
		.select()
		.from(editHistory)
		.where(eq(editHistory.tableId, tableId))
		.orderBy(asc(editHistory.step))
		.all();
}

export async function deleteEditNode(tableId: number, nodeId: string) {
	const d = db();

	// Validate: no children + node exists (2 reads in parallel)
	const [children, node, ws] = await Promise.all([
		d.select().from(editHistory).where(eq(editHistory.parentId, nodeId)).all(),
		d.select().from(editHistory).where(eq(editHistory.id, nodeId)).get(),
		d.select().from(workspaces).where(eq(workspaces.tableId, tableId)).get()
	]);

	if (children.length > 0) {
		throw new Error('Cannot delete a node with children. Delete leaf nodes first.');
	}
	if (!node) throw new Error('Edit node not found');
	if (!ws) throw new Error('Workspace not found');

	const newActiveNodeId = ws.activeNodeId === nodeId ? (node.parentId ?? null) : ws.activeNodeId;

	let newImageUrl = ws.originalImageUrl;
	if (newActiveNodeId) {
		const activeNode = await d
			.select()
			.from(editHistory)
			.where(eq(editHistory.id, newActiveNodeId))
			.get();
		if (activeNode) newImageUrl = activeNode.imageUrl;
	}

	// Delete node, then update workspace
	await d.delete(editHistory).where(eq(editHistory.id, nodeId)).run();

	return d
		.update(workspaces)
		.set({
			activeNodeId: newActiveNodeId,
			currentImageUrl: newImageUrl,
			editCount: sql`MAX(${workspaces.editCount} - 1, 0)`,
			updatedAt: new Date().toISOString()
		})
		.where(eq(workspaces.tableId, tableId))
		.returning()
		.get();
}

export function clearEditHistory(tableId: number) {
	return db().delete(editHistory).where(eq(editHistory.tableId, tableId)).run();
}

export function getAllWorkspaces() {
	return db().select().from(workspaces).all();
}

export function updateWorkspaceGlb(tableId: number, glbUrl: string) {
	return db()
		.update(workspaces)
		.set({ glbUrl, updatedAt: new Date().toISOString() })
		.where(eq(workspaces.tableId, tableId))
		.returning()
		.get();
}

export function getWorkspacesWithGlb() {
	return db()
		.select()
		.from(workspaces)
		.where(and(eq(workspaces.status, 'locked'), isNotNull(workspaces.glbUrl)))
		.all();
}
