CREATE TABLE `video_clips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`clipType` enum('hook','body','cta') NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`durationSeconds` float,
	`clipOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_variant_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobName` varchar(255) NOT NULL,
	`jobStatus` enum('pending','processing','done','error') NOT NULL DEFAULT 'pending',
	`hookCount` int DEFAULT 0,
	`variantCount` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `video_variant_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`hookClipId` int NOT NULL,
	`bodyClipId` int NOT NULL,
	`ctaClipId` int,
	`variantLabel` varchar(128) NOT NULL,
	`s3Key` varchar(512),
	`s3Url` text,
	`variantStatus` enum('pending','processing','done','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_variants_id` PRIMARY KEY(`id`)
);
