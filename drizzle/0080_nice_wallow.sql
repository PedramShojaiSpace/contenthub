CREATE TABLE `competitor_domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`domain` varchar(253) NOT NULL,
	`label` varchar(128),
	`cd_addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_domains_id` PRIMARY KEY(`id`)
);
