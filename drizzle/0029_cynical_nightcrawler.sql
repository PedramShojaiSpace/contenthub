CREATE TABLE `llm_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`llm_asset_type` enum('faq','youtube','blog','social','email') NOT NULL,
	`title` varchar(512) NOT NULL,
	`question` text,
	`targetKeyword` varchar(255),
	`semanticKeywords` text,
	`llm_asset_priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`llm_asset_status` enum('queued','in_progress','produced','published') NOT NULL DEFAULT 'queued',
	`contentItemId` int,
	`notes` text,
	`producedAt` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llm_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`topicCluster` varchar(255),
	`targetKeywords` text,
	`weeklyTarget` int DEFAULT 3,
	`llm_project_status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llm_projects_id` PRIMARY KEY(`id`)
);
