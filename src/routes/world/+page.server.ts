import { getAllWorkspaces, getWorkspacesWithGlb } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [withGlb, allWorkspaces] = await Promise.all([
		getWorkspacesWithGlb(),
		getAllWorkspaces()
	]);

	const models = withGlb
		.sort((a, b) => a.tableId - b.tableId)
		.map((w) => ({
			tableId: w.tableId,
			imageUrl: w.currentImageUrl,
			glbUrl: w.glbUrl!,
			editCount: w.editCount
		}));

	const lockedWithout3d = allWorkspaces
		.filter((w) => w.status === 'locked' && !w.glbUrl)
		.map((w) => ({ tableId: w.tableId, imageUrl: w.currentImageUrl }));

	return { models, pending: lockedWithout3d };
};
