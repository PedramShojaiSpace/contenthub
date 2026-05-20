ALTER TABLE `ebooks` ADD `sourceWebinarId` int;--> statement-breakpoint
ALTER TABLE `ebooks` ADD `sourceEbookId` int;--> statement-breakpoint
ALTER TABLE `ebooks` ADD `sourceLandingPageId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `sourceWebinarId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `sourceEbookId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `sourceLandingPageId` int;