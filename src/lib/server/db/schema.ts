import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A user session (replaces the old workspace + tableId concept)
export const sessions = sqliteTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().default('Adventurer'),
	questCompleted: integer('quest_completed', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

// Each binary choice the user made during the quest
export const questChoices = sqliteTable(
	'quest_choices',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		sessionId: text('session_id').notNull(),
		step: integer('step').notNull(),
		optionA: text('option_a').notNull(),
		optionB: text('option_b').notNull(),
		selected: text('selected').notNull(), // 'a' or 'b'
		tags: text('tags').notNull().default('[]'), // JSON array of style tags
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [index('quest_choices_session_idx').on(table.sessionId)]
);

// Each space in the user's workspace (result of quest + forge)
export const spaces = sqliteTable(
	'spaces',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		sessionId: text('session_id').notNull(),
		name: text('name').notNull(),
		originalImageUrl: text('original_image_url').notNull(),
		currentImageUrl: text('current_image_url').notNull(),
		glbUrl: text('glb_url'),
		status: text('status', { enum: ['quest', 'forging', 'complete'] })
			.notNull()
			.default('quest'),
		editCount: integer('edit_count').notNull().default(0),
		activeNodeId: text('active_node_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text('updated_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [index('spaces_session_idx').on(table.sessionId)]
);

// Version tree for forge edits
export const editHistory = sqliteTable(
	'edit_history',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		spaceId: text('space_id').notNull(),
		step: integer('step').notNull(),
		parentId: text('parent_id'),
		imageUrl: text('image_url').notNull(),
		prompt: text('prompt').notNull(),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [
		index('edit_history_space_id_idx').on(table.spaceId),
		index('edit_history_parent_id_idx').on(table.parentId)
	]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type QuestChoice = typeof questChoices.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type EditHistoryEntry = typeof editHistory.$inferSelect;
