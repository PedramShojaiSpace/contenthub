CREATE TABLE `reddit_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`redditId` varchar(32) NOT NULL,
	`subreddit` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`title` varchar(512) NOT NULL,
	`selftext` text,
	`score` int NOT NULL DEFAULT 0,
	`numComments` int NOT NULL DEFAULT 0,
	`upvoteRatio` float,
	`permalink` varchar(512) NOT NULL,
	`author` varchar(128),
	`createdUtc` bigint,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`engagementScore` int,
	`aiSummary` text,
	`aiRecommendation` text,
	`aiDraftComment` text,
	`isAnalyzed` boolean NOT NULL DEFAULT false,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`isFlagged` boolean NOT NULL DEFAULT false,
	CONSTRAINT `reddit_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `reddit_posts_redditId_unique` UNIQUE(`redditId`)
);
--> statement-breakpoint
CREATE TABLE `reddit_subreddits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subreddit` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reddit_subreddits_id` PRIMARY KEY(`id`),
	CONSTRAINT `reddit_subreddits_subreddit_unique` UNIQUE(`subreddit`)
);
