ALTER TABLE `tantra_quiz_leads`
  ADD COLUMN `source_page` varchar(64),
  ADD COLUMN `source_visitor_id` varchar(128);

CREATE TABLE `tantra_content_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `source_page` varchar(64) NOT NULL,
  `visitor_id` varchar(128) NOT NULL,
  `tantra_content_event_type` enum('page_view','video_play','video_25','video_50','video_75','video_complete','quiz_cta') NOT NULL,
  `media_id` varchar(32) NOT NULL,
  `event_at` bigint NOT NULL,
  CONSTRAINT `tantra_content_events_id` PRIMARY KEY(`id`)
);
