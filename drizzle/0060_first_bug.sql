ALTER TABLE `book_snippets` ADD `titleCardLinkedinUrl` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `titleCardXUrl` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `titleCardMetaUrl` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `linkedinCopy` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `xCopy` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `metaCopy` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `hashtags` text;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `ctaText` varchar(512);--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `bufferSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_snippets` ADD `bufferLastResult` text;