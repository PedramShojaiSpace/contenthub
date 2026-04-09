CREATE TABLE `scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`scriptType` enum('video','carousel','blog','email','reel') NOT NULL DEFAULT 'video',
	`platform` enum('meta','linkedin','x','youtube','tiktok','blog','all') NOT NULL DEFAULT 'all',
	`personaId` int,
	`contentGoal` enum('audience_growth','llm_seo','community_engagement') DEFAULT 'audience_growth',
	`scriptStatus` enum('idea','scripted','in_production','in_edit','ready_to_post','published') NOT NULL DEFAULT 'idea',
	`scriptBody` text,
	`notes` text,
	`thumbnailUrl` text,
	`linkedContentItemId` int,
	`priority` int,
	`estimatedDurationMin` int,
	`competitorAngle` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scripts_id` PRIMARY KEY(`id`)
);
