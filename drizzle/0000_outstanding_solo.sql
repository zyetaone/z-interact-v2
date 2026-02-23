CREATE TABLE `edit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` integer NOT NULL,
	`step` integer NOT NULL,
	`parent_id` text,
	`image_url` text NOT NULL,
	`prompt` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `edit_history_table_id_idx` ON `edit_history` (`table_id`);--> statement-breakpoint
CREATE INDEX `edit_history_parent_id_idx` ON `edit_history` (`parent_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` integer NOT NULL,
	`original_image_url` text NOT NULL,
	`current_image_url` text NOT NULL,
	`edit_count` integer DEFAULT 0 NOT NULL,
	`active_node_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_table_id_unique` ON `workspaces` (`table_id`);