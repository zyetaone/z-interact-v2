import { error } from '@sveltejs/kit';
import { isValidTableId } from '$lib/config/tables';
import { getWorkspace, getEditHistory } from '$lib/server/db/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const tableId = parseInt(params.tableId, 10);

	if (!isValidTableId(tableId)) {
		error(404, `Invalid table ID: ${params.tableId}`);
	}

	const [workspace, history] = await Promise.all([getWorkspace(tableId), getEditHistory(tableId)]);

	if (!workspace) {
		error(404, `No workspace found for Table ${tableId}`);
	}

	return {
		tableId,
		workspace,
		history
	};
};
