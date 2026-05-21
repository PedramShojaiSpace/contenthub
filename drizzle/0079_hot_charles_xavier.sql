CREATE TABLE `seo_content_tracker` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyword` varchar(512) NOT NULL,
	`seoContentType` enum('video','blog') NOT NULL,
	`sct_createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seo_content_tracker_id` PRIMARY KEY(`id`)
);
