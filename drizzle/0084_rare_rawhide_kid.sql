ALTER TABLE `buffer_channel_defaults` MODIFY COLUMN `bcd_default_profile_ids` varchar(2048) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `content_items` ADD `pushedChannels` text;