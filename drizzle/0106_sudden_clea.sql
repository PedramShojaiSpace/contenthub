ALTER TABLE `content_items` MODIFY COLUMN `status` enum('idea','pending_approval','drafting','review','approved','scheduled','published','pending_review') NOT NULL DEFAULT 'idea';--> statement-breakpoint
ALTER TABLE `content_items` ADD `reviewNotes` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `embeddedYoutubeVideoId` varchar(64);--> statement-breakpoint
ALTER TABLE `content_items` ADD `embeddedYoutubeEmbedStatus` enum('pending','embedded','skipped','no_match');