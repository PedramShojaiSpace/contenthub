CREATE TABLE `buffer_channel_defaults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bcd_platform` varchar(32) NOT NULL,
	`bcd_default_profile_ids` varchar(2048) NOT NULL DEFAULT '',
	`bcd_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buffer_channel_defaults_id` PRIMARY KEY(`id`),
	CONSTRAINT `buffer_channel_defaults_bcd_platform_unique` UNIQUE(`bcd_platform`)
);
