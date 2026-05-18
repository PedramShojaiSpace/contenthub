ALTER TABLE `ebook_chapters` ADD `ctaText` text;--> statement-breakpoint
ALTER TABLE `ebook_chapters` ADD `ctaUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `ebook_chapters` ADD `ctaLabel` varchar(128);--> statement-breakpoint
ALTER TABLE `ebooks` ADD `coverImageUrl` text;