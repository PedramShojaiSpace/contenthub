-- Script Factory v2.1 — The Topic Tree
-- Additive only: one new table, one new nullable column, one enum widening.
-- Nothing is dropped or rewritten, so this is safe to apply to a live database.

CREATE TABLE IF NOT EXISTS `topic_nodes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `parent_id` int,
  `path` varchar(255) NOT NULL DEFAULT '',
  `depth` int NOT NULL DEFAULT 0,
  `label` varchar(255) NOT NULL,
  `description` text,
  `topic_source_type` enum('analog_extraction','llm_expansion','manual') NOT NULL DEFAULT 'manual',
  `analog_data_entry_id` int,
  `persona_id` int,
  `vidiq_data` json,
  `topic_status` enum('active','archived') NOT NULL DEFAULT 'active',
  `last_mined_at` datetime,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `topic_nodes_id` PRIMARY KEY(`id`)
);

-- Rotation query (cron) filters on status and orders by last_mined_at.
CREATE INDEX `idx_topic_nodes_status_mined` ON `topic_nodes` (`topic_status`, `last_mined_at`);
-- Subtree lookups are prefix scans over the materialized path.
CREATE INDEX `idx_topic_nodes_path` ON `topic_nodes` (`path`);
CREATE INDEX `idx_topic_nodes_parent` ON `topic_nodes` (`parent_id`);

-- Scope an idea to a branch. Nullable: existing ideas stay unscoped.
ALTER TABLE `suggested_ideas` ADD COLUMN `topic_node_id` int;
CREATE INDEX `idx_suggested_ideas_topic_node` ON `suggested_ideas` (`topic_node_id`);

-- Widen the source enum so the operator can type an idea in directly.
ALTER TABLE `suggested_ideas`
  MODIFY COLUMN `idea_source` enum('weekly_auto','manual_generate','manual')
  NOT NULL DEFAULT 'manual_generate';
