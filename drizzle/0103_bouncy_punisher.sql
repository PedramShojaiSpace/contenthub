ALTER TABLE `blog_to_youtube_items` ADD `generatedBlogContent` longtext;--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `generatedBlogTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `focusKeyword` varchar(255);--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `metaDescription` varchar(512);--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `seoTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `wpDraftPostId` int;--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `wpDraftPostUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `blog_to_youtube_items` ADD `blogGeneratedAt` timestamp;