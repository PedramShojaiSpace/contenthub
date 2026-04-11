CREATE TABLE `wp_post_index` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wpPostId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`excerpt` text,
	`categories` text,
	`tags` text,
	`publishedAt` timestamp,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wp_post_index_id` PRIMARY KEY(`id`),
	CONSTRAINT `wp_post_index_wpPostId_unique` UNIQUE(`wpPostId`)
);
