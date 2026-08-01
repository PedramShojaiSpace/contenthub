-- Custom SQL migration file, put your code below! --
-- ═══════════════════════════════════════════════════════════════════════════
-- Script Factory v2 — "The Daily Video Engine"
-- Additive only: two new tables + nullable columns on script_factory_outputs.
-- No renames, no drops, no existing enum values modified.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Phase 1: Persistent Idea Engine ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `suggested_ideas` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `batch_id` VARCHAR(32) NOT NULL,
  `week_label` VARCHAR(16) NOT NULL,
  `idea_source` ENUM('weekly_auto','manual_generate') NOT NULL DEFAULT 'manual_generate',
  `topic` VARCHAR(500) NOT NULL,
  `rationale` TEXT,
  `audience_alignment` INT,
  `content_gap` TEXT,
  `recommended_format` VARCHAR(64),
  `recommended_patterns` JSON,
  `analog_data_source` TEXT,
  `analog_data_entry_id` INT,
  `persona_id` INT,
  `vidiq_data` JSON,
  `seed_keyword` VARCHAR(255),
  `idea_status` ENUM('suggested','shortlisted','dismissed','generated') NOT NULL DEFAULT 'suggested',
  `generated_script_id` INT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `suggested_ideas_id` PRIMARY KEY(`id`)
);

-- Dedup lookups scan by recency; batch/week lookups drive the UI.
CREATE INDEX `suggested_ideas_week_idx` ON `suggested_ideas` (`week_label`);
CREATE INDEX `suggested_ideas_batch_idx` ON `suggested_ideas` (`batch_id`);
CREATE INDEX `suggested_ideas_status_idx` ON `suggested_ideas` (`idea_status`);
CREATE INDEX `suggested_ideas_created_idx` ON `suggested_ideas` (`created_at`);

-- ─── Phase 3: Deep Research Mode ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `research_jobs` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `topic` VARCHAR(500) NOT NULL,
  `seed_keyword` VARCHAR(255),
  `research_status` ENUM('pending','researching_outliers','fetching_transcripts','extracting_patterns','complete','failed') NOT NULL DEFAULT 'pending',
  `outlier_videos` JSON,
  `transcript_video_ids` JSON,
  `pattern_ids` JSON,
  `transcripts_fetched` INT NOT NULL DEFAULT 0,
  `transcripts_cached` INT NOT NULL DEFAULT 0,
  `transcripts_failed` INT NOT NULL DEFAULT 0,
  `quota_blocked` BOOLEAN NOT NULL DEFAULT false,
  `notes` TEXT,
  `error_message` VARCHAR(512),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `research_jobs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `research_jobs_topic_idx` ON `research_jobs` (`topic`);
CREATE INDEX `research_jobs_status_idx` ON `research_jobs` (`research_status`);

-- ─── Phase 2 + Phase 4: script_factory_outputs additions ──────────────────
ALTER TABLE `script_factory_outputs`
  ADD COLUMN `persona_id` INT NULL,
  ADD COLUMN `analog_data_entry_ids` JSON NULL,
  ADD COLUMN `target_length_minutes` INT NULL,
  ADD COLUMN `source_idea_id` INT NULL,
  ADD COLUMN `research_job_id` INT NULL,
  ADD COLUMN `word_count` INT NULL,
  ADD COLUMN `production_script_id` INT NULL;
