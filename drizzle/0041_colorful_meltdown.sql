CREATE TABLE `verified_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(1024) NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`topicTags` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verified_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `verified_links_url_unique` UNIQUE(`url`)
);
