CREATE TABLE `gsc_indexing_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`wpPostId` int,
	`success` boolean NOT NULL DEFAULT false,
	`message` text,
	`source` enum('auto_publish','backfill','manual') NOT NULL DEFAULT 'auto_publish',
	`submittedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gsc_indexing_log_id` PRIMARY KEY(`id`)
);
