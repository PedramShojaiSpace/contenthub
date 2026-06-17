ALTER TABLE `syndication_jobs` ADD COLUMN `sj_archived_at` bigint;
--> statement-breakpoint
ALTER TABLE `video_jobs` ADD COLUMN `vj_archived_at` bigint;
