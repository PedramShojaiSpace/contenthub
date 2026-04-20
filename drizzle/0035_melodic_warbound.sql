CREATE TABLE `avatar_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSlug` varchar(128) NOT NULL,
	`productDescription` text,
	`cumulativePainPoints` text,
	`cumulativeMotivations` text,
	`cumulativeLanguage` text,
	`cumulativeObjections` text,
	`cumulativeThemes` text,
	`demographicPatterns` text,
	`avatarNarrative` text,
	`webinarBriefContext` text,
	`totalRespondents` int DEFAULT 0,
	`webinarCount` int DEFAULT 0,
	`lastUpdatedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `avatar_profiles_productSlug_unique` UNIQUE(`productSlug`)
);
--> statement-breakpoint
ALTER TABLE `webinar_intelligence` ADD `avatarProfileId` int;--> statement-breakpoint
ALTER TABLE `webinar_intelligence` ADD `aggregatedAt` timestamp;