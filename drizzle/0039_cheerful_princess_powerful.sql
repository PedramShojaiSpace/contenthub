CREATE TABLE `ingest_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(128) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`title` varchar(512) NOT NULL,
	`narrativeHtml` longtext NOT NULL,
	`wordCount` int DEFAULT 0,
	`citationCount` int DEFAULT 0,
	`format` varchar(64) NOT NULL,
	`generatedContent` longtext,
	`pubmedCitations` text,
	`tags` text,
	`contentItemId` int,
	`pushedAt` timestamp NOT NULL DEFAULT (now()),
	`originalCreatedAt` timestamp,
	CONSTRAINT `ingest_reports_id` PRIMARY KEY(`id`)
);
