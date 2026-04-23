CREATE TABLE `utm_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`label` varchar(255) NOT NULL,
	`source` varchar(64) NOT NULL,
	`medium` varchar(64) NOT NULL,
	`campaign` varchar(128) NOT NULL,
	`content` varchar(128),
	`term` varchar(128),
	`destination` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `utm_links_id` PRIMARY KEY(`id`)
);
