CREATE TABLE `readability_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateLabel` varchar(16) NOT NULL,
	`greenCount` int NOT NULL DEFAULT 0,
	`amberCount` int NOT NULL DEFAULT 0,
	`redCount` int NOT NULL DEFAULT 0,
	`totalCount` int NOT NULL DEFAULT 0,
	`snapshotAt` bigint NOT NULL,
	CONSTRAINT `readability_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_items` ADD `readabilityScore` varchar(8);--> statement-breakpoint
ALTER TABLE `content_items` ADD `readabilityTransitionPct` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `readabilityMaxRun` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `readabilityUpdatedAt` bigint;