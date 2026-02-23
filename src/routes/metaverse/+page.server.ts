import type { PageServerLoad } from './$types';
import { getAllCompletedSpaces } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const allSpaces = await getAllCompletedSpaces();

	return {
		models: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			imageUrl: s.currentImageUrl,
			glbUrl: s.glbUrl!,
			editCount: s.editCount
		}))
	};
};
