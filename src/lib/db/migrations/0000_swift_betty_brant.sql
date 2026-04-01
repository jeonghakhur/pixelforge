CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `component_files` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`style_mode` text NOT NULL,
	`file_type` text NOT NULL,
	`file_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `component_node_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`figma_node_data` text NOT NULL,
	`figma_version` text,
	`trigger` text DEFAULT 'generate' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`figma_node_id` text,
	`figma_file_key` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`scss` text,
	`tsx` text,
	`description` text,
	`default_style_mode` text DEFAULT 'css-modules' NOT NULL,
	`menu_order` integer DEFAULT 0 NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `histories` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`figma_url` text,
	`figma_key` text,
	`description` text,
	`pages_cache` text,
	`figma_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screens` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`file_path` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`authors` text,
	`category` text,
	`status` text DEFAULT 'wip' NOT NULL,
	`since_date` text,
	`updated_date` text,
	`figma_url` text,
	`figma_screenshot` text,
	`impl_screenshot` text,
	`visible` integer DEFAULT true NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`display_order_key` text,
	`playwright_status` text DEFAULT 'pending' NOT NULL,
	`playwright_score` integer,
	`playwright_report` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `screens_route_unique` ON `screens` (`route`);--> statement-breakpoint
CREATE TABLE `sync_payloads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_hash` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `token_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`source` text NOT NULL,
	`figma_version` text,
	`token_counts` text NOT NULL,
	`tokens_data` text NOT NULL,
	`diff_summary` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `token_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`figma_url` text NOT NULL,
	`figma_key` text NOT NULL,
	`figma_version` text,
	`last_extracted_at` integer,
	`token_count` integer DEFAULT 0 NOT NULL,
	`content_hash` text,
	`ui_screenshot` text,
	`figma_screenshot` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_sources_project_id_type_unique` ON `token_sources` (`project_id`,`type`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`raw` text,
	`source` text DEFAULT 'node-scan',
	`mode` text,
	`collection_name` text,
	`alias` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);