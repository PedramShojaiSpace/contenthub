CREATE TABLE `session_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`ss_scriptType` enum('hook','body','cta') NOT NULL,
	`scriptOrder` int NOT NULL DEFAULT 0,
	`scriptText` text NOT NULL,
	`approved` boolean NOT NULL DEFAULT false,
	`approvedAt` timestamp,
	`recordingUrl` text,
	`recordingKey` varchar(512),
	`ss_createdAt` timestamp NOT NULL DEFAULT (now()),
	`ss_updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_production_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(128) NOT NULL,
	`sessionName` varchar(255) NOT NULL,
	`idea` text NOT NULL,
	`vps_platform` enum('tiktok','instagram','youtube','linkedin','x','meta') NOT NULL DEFAULT 'instagram',
	`vps_status` enum('scripting','ready_to_record','uploading','stitching','done') NOT NULL DEFAULT 'scripting',
	`variantJobId` int,
	`vps_createdAt` timestamp NOT NULL DEFAULT (now()),
	`vps_updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_production_sessions_id` PRIMARY KEY(`id`)
);
