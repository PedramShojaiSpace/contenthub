ALTER TABLE `content_items` ADD `publishUrl` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `analyticsViews` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_items` ADD `analyticsLikes` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_items` ADD `analyticsComments` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `content_items` ADD `analyticsShares` int DEFAULT 0;