CREATE TABLE `coverage_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`weekLabel` varchar(64) NOT NULL,
	`totalQueries` int NOT NULL DEFAULT 0,
	`mentionedCount` int NOT NULL DEFAULT 0,
	`gapCount` int NOT NULL DEFAULT 0,
	`addressedCount` int NOT NULL DEFAULT 0,
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coverage_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_items` ADD `gapQueryId` int;