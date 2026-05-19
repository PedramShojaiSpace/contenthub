CREATE TABLE `reddit_trend_digests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`briefing` text NOT NULL,
	`topTopics` text NOT NULL,
	`postsAnalyzed` int NOT NULL DEFAULT 0,
	`subredditsScanned` int NOT NULL DEFAULT 0,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reddit_trend_digests_id` PRIMARY KEY(`id`)
);
