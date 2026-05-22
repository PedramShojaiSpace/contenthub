CREATE TABLE `keyword_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kc_user_id` int NOT NULL,
	`kc_name` varchar(128) NOT NULL,
	`kc_pillar_keyword` varchar(256) NOT NULL,
	`kc_description` text,
	`kc_monetization_goal` varchar(64) NOT NULL DEFAULT 'academy',
	`kc_status` varchar(32) NOT NULL DEFAULT 'active',
	`kc_created_at` timestamp NOT NULL DEFAULT (now()),
	`kc_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keyword_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyword_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kt_campaign_id` int NOT NULL,
	`kt_user_id` int NOT NULL,
	`kt_keyword` varchar(256) NOT NULL,
	`kt_keyword_type` varchar(32) NOT NULL DEFAULT 'cluster',
	`kt_funnel_stage` varchar(16) NOT NULL DEFAULT 'tofu',
	`kt_monetization_tag` varchar(64) NOT NULL DEFAULT 'academy',
	`kt_search_volume` int,
	`kt_difficulty` int,
	`kt_cpc` varchar(16),
	`kt_current_position` varchar(16),
	`kt_content_status` varchar(32) NOT NULL DEFAULT 'not_started',
	`kt_content_item_id` int,
	`kt_published_url` varchar(512),
	`kt_notes` text,
	`kt_priority` int NOT NULL DEFAULT 50,
	`kt_created_at` timestamp NOT NULL DEFAULT (now()),
	`kt_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keyword_targets_id` PRIMARY KEY(`id`)
);
