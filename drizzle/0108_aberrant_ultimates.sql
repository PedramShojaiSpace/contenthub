ALTER TABLE `content_items` ADD `sendToSubstack` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `content_items` ADD `substackPostId` varchar(128);--> statement-breakpoint
ALTER TABLE `content_items` ADD `substackPostUrl` text;