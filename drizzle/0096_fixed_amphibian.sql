CREATE TABLE `video_push_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content_item_id` int NOT NULL,
	`channel_id` varchar(128) NOT NULL,
	`channel_name` varchar(255) NOT NULL,
	`service` varchar(64) NOT NULL,
	`buffer_post_id` varchar(255),
	`caption` text,
	`scheduled_at` bigint,
	`pushed_at` timestamp NOT NULL DEFAULT (now()),
	`views` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`last_synced_at` timestamp,
	CONSTRAINT `video_push_logs_id` PRIMARY KEY(`id`)
);
