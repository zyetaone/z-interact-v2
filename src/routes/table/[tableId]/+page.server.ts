import { error } from '@sveltejs/kit';
import { isValidTableId } from '$lib/config/tables';
import { getWorkspace, getEditHistory } from '$lib/server/db/queries';
import { ASSET_IMAGES } from '$lib/config/assets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const tableId = parseInt(params.tableId, 10);

	if (!isValidTableId(tableId)) {
		error(404, `Invalid table ID: ${params.tableId}. Must be 1-10.`);
	}

	const [workspace, history] = await Promise.all([getWorkspace(tableId), getEditHistory(tableId)]);

	return {
		tableId,
		workspace: workspace ?? null,
		history,
		assetImages: ASSET_IMAGES
	};
};
