CREATE TABLE `personas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`painPoints` text,
	`aspirations` text,
	`topQuestions` text,
	`intelligenceReport` text,
	`ctaCopy` text,
	`landingPageUrl` varchar(512),
	`primaryGoal` enum('audience_growth','llm_seo','community_engagement') DEFAULT 'audience_growth',
	`icon` varchar(8),
	`color` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personas_id` PRIMARY KEY(`id`),
	CONSTRAINT `personas_name_unique` UNIQUE(`name`),
	CONSTRAINT `personas_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `content_items` ADD `wpPostId` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `personaId` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `contentGoal` enum('audience_growth','llm_seo','community_engagement') DEFAULT 'audience_growth';