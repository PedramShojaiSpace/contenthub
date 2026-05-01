CREATE TABLE `newsfeed_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`source` varchar(255),
	`url` varchar(1024) NOT NULL,
	`imageUrl` text,
	`description` text,
	`commentary` text,
	`topic` varchar(128),
	`newsfeedStatus` enum('pending','approved','dismissed') NOT NULL DEFAULT 'pending',
	`contentItemId` int,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	CONSTRAINT `newsfeed_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsfeed_articles_url_unique` UNIQUE(`url`)
);
