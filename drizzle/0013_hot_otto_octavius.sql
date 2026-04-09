ALTER TABLE `personas` ADD `enrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `personas` ADD `surveySource` varchar(512);--> statement-breakpoint
ALTER TABLE `personas` ADD `surveyResponseCount` int DEFAULT 0;