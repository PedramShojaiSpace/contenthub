CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `content_pillars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dayOfWeek` int NOT NULL,
	`pillarName` varchar(128) NOT NULL,
	`topicDescription` text,
	`platform` varchar(64) DEFAULT 'all',
	`color` varchar(32) DEFAULT '#6366f1',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_pillars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollment_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`windowName` varchar(128) NOT NULL,
	`startDate` bigint NOT NULL,
	`endDate` bigint NOT NULL,
	`contentGoal` varchar(64) DEFAULT 'audience_growth',
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollment_windows_id` PRIMARY KEY(`id`)
);
