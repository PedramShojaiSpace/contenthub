CREATE TABLE `keyword_searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ksh_keyword` varchar(512) NOT NULL,
	`ksh_search_volume` int,
	`ksh_difficulty` int,
	`ksh_cpc` varchar(32),
	`ksh_intent` varchar(64),
	`ksh_trend_data` text,
	`ksh_is_favorite` boolean NOT NULL DEFAULT false,
	`ksh_user_id` int,
	`ksh_created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_searches_id` PRIMARY KEY(`id`)
);
