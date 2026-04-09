CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mediaAssetType` enum('book','podcast','film','youtube','interview') NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`url` text,
	`platform` varchar(128),
	`episodeNumber` int,
	`publishedYear` int,
	`durationMin` int,
	`topicTags` text,
	`credibilitySignal` varchar(255),
	`reachEstimate` bigint,
	`activeInjection` boolean NOT NULL DEFAULT true,
	`injectionPriority` int DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
