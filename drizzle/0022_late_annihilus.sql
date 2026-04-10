CREATE TABLE `webinar_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(512) NOT NULL,
	`cta` text,
	`personaIds` text,
	`targetLengthMinutes` int DEFAULT 60,
	`registrationUrl` text,
	`outline` text,
	`hookScript` text,
	`webinarStatus` enum('draft','ready','live','completed') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_sessions_id` PRIMARY KEY(`id`)
);
