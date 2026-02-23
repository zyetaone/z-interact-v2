import { json, error } from '@sveltejs/kit';
import { isValidTableId } from '$lib/config/tables';
import { getWorkspace, createWorkspace, updateWorkspace, clearEditHistory } from '$lib/server/db/queries';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let body: any;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const tableId: number = body.tableId;
	const imageUrl: string = body.imageUrl;

	if (!tableId || !imageUrl) {
		error(400, 'Missing required fields: tableId, imageUrl');
	}

	if (!isValidTableId(tableId)) {
		error(400, 'Invalid tableId');
	}

	// Validate imageUrl — only allow safe schemes
	if (
		typeof imageUrl !== 'string' ||
		(!imageUrl.startsWith('/uploads/') &&
			!imageUrl.startsWith('/assets/') &&
			!imageUrl.startsWith('/api/r2/') &&
			!imageUrl.startsWith('https://'))
	) {
		error(400, 'Invalid imageUrl: must be a local upload/asset path or HTTPS URL');
	}

	const existing = await getWorkspace(tableId);

	if (existing) {
		// Clean up orphaned edit history before resetting workspace
		await clearEditHistory(tableId);
		const updated = await updateWorkspace(tableId, {
			originalImageUrl: imageUrl,
			currentImageUrl: imageUrl,
			editCount: 0,
			status: 'draft',
			activeNodeId: null
		});
		return json({ workspace: updated });
	}

	const workspace = await createWorkspace({
		tableId,
		originalImageUrl: imageUrl,
		currentImageUrl: imageUrl
	});

	return json({ workspace });
};
