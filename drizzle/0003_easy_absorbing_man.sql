CREATE TABLE `research_competitor_mentions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`queryId` int NOT NULL,
	`brand` varchar(255) NOT NULL,
	`model` varchar(128),
	`rank` int,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_competitor_mentions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_queries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`gumshoeQueryId` int,
	`personaName` varchar(128),
	`query` text NOT NULL,
	`topicTags` text,
	`gapScore` int DEFAULT 0,
	`urbanMonkMentioned` int DEFAULT 0,
	`contentItemId` int,
	`queryStatus` enum('unused','in_progress','published') DEFAULT 'unused',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gumshoeReportId` int,
	`reportName` varchar(255),
	`reportFocus` varchar(255),
	`reportDescription` text,
	`weekLabel` varchar(64),
	`totalQueries` int DEFAULT 0,
	`totalPersonas` int DEFAULT 0,
	`totalCompetitorMentions` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_reports_id` PRIMARY KEY(`id`)
);
