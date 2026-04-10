DROP TABLE `app_settings`;--> statement-breakpoint
DROP TABLE `content_pillars`;--> statement-breakpoint
DROP TABLE `enrollment_windows`;--> statement-breakpoint
ALTER TABLE `content_items` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','all') NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `generated_images` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','all') NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `scripts` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','all') NOT NULL DEFAULT 'all';