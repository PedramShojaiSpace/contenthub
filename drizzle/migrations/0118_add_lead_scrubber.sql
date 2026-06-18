-- Lead Scrubber: 3-tier cold lead prospecting tables
-- Migration 0118

CREATE TABLE IF NOT EXISTS `lead_prospects` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `lp_source` enum('reddit','youtube') NOT NULL,
  `sourceId` varchar(128) NOT NULL UNIQUE,
  `title` text,
  `body` text NOT NULL,
  `url` text NOT NULL,
  `author` varchar(128),
  `subredditOrChannel` varchar(128),
  `keywordsMatched` text,
  `lp_status` enum('new','engaged','email_found','converted','archived') NOT NULL DEFAULT 'new',
  `notes` text,
  `engagedAt` bigint,
  `emailFound` varchar(320),
  `emailConfidence` varchar(32),
  `archivedAt` bigint,
  `lp_createdAt` timestamp NOT NULL DEFAULT (now()),
  `lp_updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lead_keywords` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `keyword` varchar(128) NOT NULL UNIQUE,
  `category` varchar(64) NOT NULL DEFAULT 'general',
  `active` boolean NOT NULL DEFAULT true,
  `lk_createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `lead_subreddits` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `subreddit` varchar(128) NOT NULL UNIQUE,
  `active` boolean NOT NULL DEFAULT true,
  `ls_createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `lead_yt_channels` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `channelId` varchar(64) NOT NULL UNIQUE,
  `channelName` varchar(128) NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `lyc_createdAt` timestamp NOT NULL DEFAULT (now())
);

-- Seed default Urban Monk keywords
INSERT IGNORE INTO `lead_keywords` (`keyword`, `category`) VALUES
  ('burnout', 'stress'),
  ('cortisol', 'stress'),
  ('chronic stress', 'stress'),
  ('adrenal fatigue', 'stress'),
  ('can''t sleep', 'sleep'),
  ('insomnia', 'sleep'),
  ('sleep quality', 'sleep'),
  ('meditation doesn''t work', 'meditation'),
  ('can''t meditate', 'meditation'),
  ('how to meditate', 'meditation'),
  ('gut health', 'supplements'),
  ('leaky gut', 'supplements'),
  ('brain fog', 'supplements'),
  ('longevity', 'longevity'),
  ('biohacking', 'longevity'),
  ('functional medicine', 'health'),
  ('integrative medicine', 'health'),
  ('ayurveda', 'ancient wisdom'),
  ('qi gong', 'ancient wisdom'),
  ('urban monk', 'brand'),
  ('pedram shojai', 'brand');

-- Seed default subreddits
INSERT IGNORE INTO `lead_subreddits` (`subreddit`) VALUES
  ('meditation'),
  ('longevity'),
  ('biohacking'),
  ('Nootropics'),
  ('Ayurveda'),
  ('yoga'),
  ('intermittentfasting'),
  ('sleep'),
  ('stress'),
  ('Supplements'),
  ('FunctionalMedicine'),
  ('holistic'),
  ('spirituality'),
  ('selfimprovement'),
  ('Anxiety');

-- Seed default YouTube competitor channels to monitor
INSERT IGNORE INTO `lead_yt_channels` (`channelId`, `channelName`) VALUES
  ('UCn_liqkFRHmMSMmHDTRuqYA', 'Andrew Huberman'),
  ('UCpWMpKBjSNJuPxZKnGLMsQg', 'Dr. Mark Hyman'),
  ('UCvqZGj3bDXCMnKVFMkuGCww', 'Sadhguru'),
  ('UCWIzrKzN4KHO6XTMF9LW0_A', 'Deepak Chopra'),
  ('UCJ_5Gy8wDGUiJqJhqJCRfWw', 'Dr. Rhonda Patrick');
