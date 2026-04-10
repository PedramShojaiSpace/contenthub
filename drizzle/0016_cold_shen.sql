CREATE TABLE `avatar_messaging_frameworks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`structure` text,
	`example` text,
	`useCase` varchar(128),
	`emotionalJob` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_messaging_frameworks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `avatar_objections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`objection` varchar(255) NOT NULL,
	`underlyingFear` text,
	`responseFramework` text,
	`contentExample` text,
	`keyInsight` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_objections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `avatar_pain_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stage` varchar(64) NOT NULL,
	`category` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`emotionalHook` varchar(255),
	`contentTopics` text,
	`headlineFormula` text,
	`exampleHeadline` text,
	`keyQuote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_pain_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `avatar_personas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`profile` text,
	`communicationStyle` text,
	`contentNeeds` text,
	`salesApproach` text,
	`traits` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_personas_id` PRIMARY KEY(`id`)
);
