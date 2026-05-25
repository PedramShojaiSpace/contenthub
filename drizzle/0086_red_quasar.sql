CREATE TABLE `gsc_position_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gph_content_item_id` int,
	`gph_url` varchar(512) NOT NULL,
	`gph_clicks` int NOT NULL DEFAULT 0,
	`gph_impressions` int NOT NULL DEFAULT 0,
	`gph_ctr` varchar(16),
	`gph_position` varchar(16),
	`gph_recorded_at` bigint NOT NULL,
	`gph_created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gsc_position_history_id` PRIMARY KEY(`id`)
);
