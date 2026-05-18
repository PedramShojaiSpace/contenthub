ALTER TABLE `book_snippets` ADD `softRejected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `generated_images` ADD `softRejected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `ingest_reports` ADD `softRejected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `llm_assets` ADD `softRejected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `newsfeed_articles` ADD `softRejected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `research_queries` ADD `softRejected` boolean DEFAULT false;