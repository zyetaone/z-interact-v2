import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	tableId: integer('table_id').notNull().unique(),
	originalImageUrl: text('original_image_url').notNull(),
	currentImageUrl: text('current_image_url').notNull(),
	editCount: integer('edit_count').notNull().default(0),
	activeNodeId: text('active_node_id'),
	glbUrl: text('glb_url'),
	status: text('status', { enum: ['draft', 'editing', 'locked'] })
		.notNull()
		.default('draft'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const editHistory = sqliteTable(
	'edit_history',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tableId: integer('table_id').notNull(),
		step: integer('step').notNull(),
		parentId: text('parent_id'),
		imageUrl: text('image_url').notNull(),
		prompt: text('prompt').notNull(),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [
		index('edit_history_table_id_idx').on(table.tableId),
		index('edit_history_parent_id_idx').on(table.parentId)
	]
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type EditHistoryEntry = typeof editHistory.$inferSelect;
