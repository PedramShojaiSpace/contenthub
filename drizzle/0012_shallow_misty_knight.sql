CREATE TABLE `press_hits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outlet` varchar(255) NOT NULL,
	`medium` enum('online','print','podcast','broadcast','social','radio') NOT NULL DEFAULT 'online',
	`description` text,
	`impressions` bigint,
	`impressionsLabel` varchar(128),
	`coverageDate` varchar(64),
	`url` text,
	`topicTags` text,
	`authorityTier` enum('S','A','B') NOT NULL DEFAULT 'B',
	`book` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `press_hits_id` PRIMARY KEY(`id`)
);
