ALTER TABLE `ebooks` ADD `sourceDocumentName` varchar(255);--> statement-breakpoint
ALTER TABLE `ebooks` ADD `sourceDocumentS3Url` text;--> statement-breakpoint
ALTER TABLE `ebooks` ADD `sourceDocumentText` longtext;--> statement-breakpoint
ALTER TABLE `ebooks` ADD `sourceNarrative` text;