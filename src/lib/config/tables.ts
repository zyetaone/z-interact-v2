export const TABLE_COUNT = 10;
export const EDITOR_TABLE_ID = 0;
export const MAX_EDITS_PER_TABLE = 20;

export function isValidTableId(tableId: number): boolean {
	return Number.isInteger(tableId) && tableId >= 0 && tableId <= TABLE_COUNT;
}
