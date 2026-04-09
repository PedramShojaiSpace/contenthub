CREATE TABLE `landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`personaId` int,
	`personaName` varchar(128),
	`offer` enum('academy','retreat','supplements','free_guide','custom') NOT NULL DEFAULT 'academy',
	`offerCustomLabel` varchar(255),
	`contentAngle` text,
	`copyBody` text,
	`gammaGenerationId` varchar(128),
	`gammaUrl` text,
	`landingPageStatus` enum('draft','generating','published','failed') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`)
);
