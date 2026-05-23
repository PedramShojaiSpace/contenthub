CREATE TABLE `keyword_rank_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`krh_target_id` int NOT NULL,
	`krh_keyword` varchar(256) NOT NULL,
	`krh_position` int,
	`krh_clicks` int DEFAULT 0,
	`krh_impressions` int DEFAULT 0,
	`krh_ctr` varchar(16),
	`krh_week_label` varchar(16) NOT NULL,
	`krh_snapshot_at` bigint NOT NULL,
	`krh_created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_rank_history_id` PRIMARY KEY(`id`)
);
