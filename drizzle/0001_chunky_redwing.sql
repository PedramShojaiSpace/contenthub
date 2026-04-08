CREATE TABLE `content_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`rawIdea` text,
	`platform` enum('meta','linkedin','x','youtube','all') NOT NULL DEFAULT 'all',
	`status` enum('idea','drafting','review','approved','scheduled','published') NOT NULL DEFAULT 'idea',
	`textContent` text,
	`imageUrl` text,
	`imageKey` text,
	`imagePrompt` text,
	`scheduledAt` bigint,
	`publishedAt` bigint,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentItemId` int,
	`platform` enum('meta','linkedin','x','youtube','all') NOT NULL DEFAULT 'all',
	`imageUrl` text NOT NULL,
	`imageKey` text,
	`prompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('meta','linkedin','x','youtube') NOT NULL,
	`voiceGuidelines` text,
	`promptTemplate` text,
	`documentUrl` text,
	`documentKey` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_strategies_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_strategies_platform_unique` UNIQUE(`platform`)
);
