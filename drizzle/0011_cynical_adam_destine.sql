CREATE TABLE `competitor_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` varchar(64) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`channelUrl` text,
	`thumbnail` text,
	`subscriberCount` int,
	`notes` text,
	`lastCheckedAt` bigint,
	`trackedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `competitor_channels_channelId_unique` UNIQUE(`channelId`)
);
