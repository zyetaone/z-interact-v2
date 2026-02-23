import { json, error } from '@sveltejs/kit';
import { generateGlb } from '$lib/server/ai';
import { resolveImageForFal } from '$lib/server/ai/fal-config';
import { getWorkspace, getWorkspacesWithGlb, updateWorkspaceGlb } from '$lib/server/db/queries';
import { persistGlb } from '$lib/server/storage';
import type { RequestHandler } from './$types';

/**
 * POST /api/iso
 *
 * Generates a 3D GLB model from a workspace image using Trellis-2,
 * persists the GLB to R2, and updates the workspace record.
 * Body: { tableId: number }
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { tableId } = body as { tableId?: number };

	if (typeof tableId !== 'number' || tableId < 1 || tableId > 10) {
		error(400, 'Invalid tableId: must be a number between 1 and 10');
	}

	const workspace = await getWorkspace(tableId);
	if (!workspace) {
		error(404, `No workspace found for table ${tableId}`);
	}
	if (workspace.status !== 'locked') {
		error(409, `Workspace for table ${tableId} is not locked (status: ${workspace.status})`);
	}
	if (workspace.glbUrl) {
		return json({ glbUrl: workspace.glbUrl, cached: true });
	}

	// Resolve local R2 paths to fal.ai-accessible URLs
	const imageUrl = await resolveImageForFal(workspace.currentImageUrl);

	try {
		const { glbUrl: tempGlbUrl } = await generateGlb({ imageUrl });
		const permanentGlbUrl = await persistGlb(tempGlbUrl);
		const updated = await updateWorkspaceGlb(tableId, permanentGlbUrl);

		return json({ glbUrl: updated?.glbUrl ?? permanentGlbUrl });
	} catch (e) {
		const message = e instanceof Error ? e.message : '3D generation failed';
		error(500, message);
	}
};

/**
 * GET /api/iso
 *
 * Returns all locked workspaces that have a GLB model URL.
 */
export const GET: RequestHandler = async () => {
	const items = await getWorkspacesWithGlb();
	const models = items
		.sort((a, b) => a.tableId - b.tableId)
		.map((w) => ({
			tableId: w.tableId,
			imageUrl: w.currentImageUrl,
			glbUrl: w.glbUrl
		}));

	return json({ models, count: models.length });
};
