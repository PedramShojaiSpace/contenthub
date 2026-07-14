-- YouTube Analytics Snapshots
CREATE TABLE IF NOT EXISTS `yt_video_snapshots` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `video_id` varchar(64) NOT NULL,
  `title` varchar(512) NOT NULL,
  `published_at` bigint,
  `thumbnail_url` varchar(1024),
  `views` int DEFAULT 0,
  `likes` int DEFAULT 0,
  `comments` int DEFAULT 0,
  `shares` int DEFAULT 0,
  `impressions` int DEFAULT 0,
  `thumbnail_ctr` float,
  `avg_view_duration_sec` int,
  `avg_view_pct` float,
  `estimated_minutes_watched` int,
  `vidiq_score` int,
  `vidiq_score_updated_at` bigint,
  `snapshot_date` varchar(10) NOT NULL,
  `snapshot_at` bigint NOT NULL
);

-- YouTube Comments
CREATE TABLE IF NOT EXISTS `yt_comments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `comment_id` varchar(128) NOT NULL UNIQUE,
  `video_id` varchar(64) NOT NULL,
  `video_title` varchar(512),
  `author_name` varchar(256),
  `author_profile_image_url` varchar(1024),
  `text` text NOT NULL,
  `like_count` int DEFAULT 0,
  `published_at` bigint,
  `yt_comment_reply_status` enum('unread','read','replied','ignored') NOT NULL DEFAULT 'unread',
  `reply_text` text,
  `replied_at` bigint,
  `ai_suggested_reply` text,
  `fetched_at` bigint NOT NULL
);

-- Headline Generations
CREATE TABLE IF NOT EXISTS `yt_headline_generations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `topic` varchar(512) NOT NULL,
  `pillar` varchar(128),
  `headlines` json NOT NULL,
  `selected_title` varchar(512),
  `linked_script_id` int,
  `linked_pipeline_video_id` int,
  `created_at` bigint NOT NULL
);
