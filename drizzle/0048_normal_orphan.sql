CREATE TABLE `dm_playbooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoTopic` text NOT NULL,
	`triggerKeyword` varchar(64) NOT NULL,
	`leadMagnet` text NOT NULL,
	`leadMagnetUrl` text,
	`platform` varchar(32) NOT NULL DEFAULT 'instagram',
	`videoCTALine` text,
	`messagesJson` longtext,
	`setupInstructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dm_playbooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hook_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` text NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT 'tiktok',
	`targetPersona` text,
	`hooksJson` longtext NOT NULL,
	`topPick` varchar(64),
	`topPickReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hook_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repurpose_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceTitle` varchar(255) NOT NULL,
	`sourceTextSnippet` text,
	`targetPlatforms` text NOT NULL,
	`postsPerPlatform` int DEFAULT 3,
	`resultJson` longtext,
	`totalPieces` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repurpose_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `script_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` text NOT NULL,
	`hook` text NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT 'tiktok',
	`targetLengthSeconds` int DEFAULT 60,
	`cta` text,
	`socialSeoKeywords` text,
	`targetPersona` text,
	`fullScript` longtext NOT NULL,
	`scriptJson` longtext NOT NULL,
	`captionHook` text,
	`suggestedHashtags` text,
	`wordCount` int,
	`estimatedSeconds` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `script_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantId` int NOT NULL,
	`variant` varchar(4) NOT NULL,
	`views` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`follows` int DEFAULT 0,
	`dmTriggers` int DEFAULT 0,
	`engagementRate` float DEFAULT 0,
	`accountHandle` varchar(128),
	`notes` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testName` varchar(255) NOT NULL,
	`topic` text NOT NULL,
	`platform` varchar(32) NOT NULL,
	`variantType` varchar(32) NOT NULL,
	`variantA` text NOT NULL,
	`variantB` text NOT NULL,
	`variantC` text,
	`notes` text,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`winner` varchar(4),
	`winnerReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viral_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`niche` text NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT 'all',
	`topicsJson` longtext NOT NULL,
	`topPick` text,
	`weeklyTheme` text,
	`count` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_topics_id` PRIMARY KEY(`id`)
);
