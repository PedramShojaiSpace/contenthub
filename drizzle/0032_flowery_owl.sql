ALTER TABLE `content_items` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','carousel','all') NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `generated_images` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','carousel','all') NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `scripts` MODIFY COLUMN `platform` enum('meta','linkedin','x','youtube','tiktok','blog','carousel','all') NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `content_items` ADD `carouselData` text;