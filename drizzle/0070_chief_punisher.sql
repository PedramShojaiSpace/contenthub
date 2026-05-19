ALTER TABLE `reddit_posts` ADD `isCommented` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reddit_posts` ADD `commentedAt` timestamp;