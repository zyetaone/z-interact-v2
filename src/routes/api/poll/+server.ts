import { json } from '@sveltejs/kit';
import { getAllWorkspaces } from '$lib/server/db/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const workspaces = await getAllWorkspaces();
	return json({ workspaces, timestamp: Date.now() });
};
