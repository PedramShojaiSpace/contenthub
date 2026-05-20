ALTER TABLE `podcast_episodes` ADD `intakeToken` varchar(64);--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD `intakeSubmittedAt` timestamp;--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD `intakeStatus` enum('not_sent','sent','submitted') DEFAULT 'not_sent';--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD CONSTRAINT `podcast_episodes_intakeToken_unique` UNIQUE(`intakeToken`);