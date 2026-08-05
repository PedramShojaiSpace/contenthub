-- ═══════════════════════════════════════════════════════════════════════════════
-- Script Factory v2.2 → v2.4 — PRODUCTION ROLLBACK
--
-- Reverses v24-production-migration.sql, and NOTHING ELSE.
-- Target: TiDB Serverless, database iUgsiz76NwfDUVHZHV7CyJ
--
-- ┌─ WHAT ROLLBACK CAN AND CANNOT RECOVER ──────────────────────────────────┐
-- │ CAN:    remove the 3 tables and 15 columns the migration added, putting  │
-- │         the schema back to its pre-migration shape.                      │
-- │                                                                          │
-- │ CANNOT: recover data written INTO those columns or tables after the      │
-- │         deploy. Dropping a column destroys its contents irreversibly.    │
-- │         If scripts were generated post-deploy, their persona_id,         │
-- │         generation_params, variant lineage and section history are gone   │
-- │         the moment Section 2 runs — and any variant script ROW survives   │
-- │         while losing all knowledge of what it is a variant OF.            │
-- │                                                                          │
-- │ THEREFORE: Section 2 (column drops) is the destructive half. Read the    │
-- │            decision gate in Section 0 before running it. In most         │
-- │            incidents you do NOT want it.                                 │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- THE IMPORTANT POINT ABOUT THIS ROLLBACK: you probably do not need it.
-- Every column added is nullable and every table added is new, so the previous
-- application version ignores all of them completely — it does not SELECT them,
-- does not write them, and does not know they exist. Rolling back the CODE
-- (redeploy the previous build) restores previous behaviour with the schema left
-- in place, at zero data risk. The schema additions are inert to old code.
--
-- Reach for THIS file only if the additions themselves are the problem — for
-- example a name collision with something added independently, or a genuine
-- requirement to return the database to a byte-identical prior shape.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 0 — DECISION GATE. Run these and read the answers before proceeding.
-- ───────────────────────────────────────────────────────────────────────────────

-- 0.1 Has anything been written to the new tables since deploy?
--     Non-zero counts mean dropping them destroys real work.
SELECT 'research_jobs'   AS tbl, COUNT(*) AS rows_present FROM research_jobs
UNION ALL SELECT 'suggested_ideas', COUNT(*) FROM suggested_ideas
UNION ALL SELECT 'topic_nodes',     COUNT(*) FROM topic_nodes;
-- If all zero  -> Section 1 is safe.
-- If non-zero  -> export those rows first, or do not run Section 1.

-- 0.2 Have any scripts been generated under the new schema?
--     Any row with a non-NULL generation_params was created post-deploy and
--     will lose its provenance if Section 2 runs.
SELECT COUNT(*) AS total_scripts,
       SUM(CASE WHEN generation_params IS NOT NULL THEN 1 ELSE 0 END) AS post_deploy_scripts,
       SUM(CASE WHEN parent_script_id  IS NOT NULL THEN 1 ELSE 0 END) AS variant_scripts,
       SUM(CASE WHEN section_history   IS NOT NULL THEN 1 ELSE 0 END) AS scripts_with_edit_history
FROM script_factory_outputs;
-- post_deploy_scripts = 0  -> Section 2 destroys nothing. Proceed if needed.
-- post_deploy_scripts > 0  -> STOP. Roll back the CODE instead (see header).
--                             Their script_body survives, but every fact about
--                             how they were made, and every variant relationship,
--                             is destroyed by the drops below.

-- 0.3 Has any offer profile been bound?
SELECT COUNT(*) AS entries,
       SUM(CASE WHEN offer_profile IS NOT NULL THEN 1 ELSE 0 END) AS with_offer_profile
FROM analog_data_entries;
-- with_offer_profile > 0 -> dropping offer_profile deletes the parsed offer
--                           ladder. It can be re-derived by re-running the
--                           sales-page seed, but it is not recoverable from the
--                           column itself once dropped.

-- 0.3b Are there rows whose metric definition is only knowable from metric_version?
SELECT SUM(CASE WHEN metric_version IS NOT NULL THEN 1 ELSE 0 END) AS labelled_rows,
       SUM(CASE WHEN metric_version IS NULL     THEN 1 ELSE 0 END) AS unlabelled_rows
FROM script_factory_outputs;
-- labelled_rows > 0 -> those rows carry a v2.2-instance verification_pct. Dropping
--                      metric_version does not change the NUMBER, but it removes the
--                      only marker distinguishing it from the pre-v2.2 marker-ratio
--                      figure on the older rows. After the drop, verification_pct is
--                      once again a column holding two incompatible measures under
--                      one name, with no way to tell them apart. Metadata loss, not
--                      data loss — but it is the exact ambiguity this column existed
--                      to remove.

-- 0.4 Take a fresh backup NOW, before any drop. The pre-deploy backup does not
--     contain anything created since the deploy. See plan document Part 4.


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — DROP THE THREE NEW TABLES
--
-- Safe if 0.1 returned all zeros. These tables did not exist before the
-- migration, so nothing that predates the deploy can depend on them.
-- Indexes are dropped implicitly with their table; no separate DROP INDEX needed.
-- ───────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS `topic_nodes`;
DROP TABLE IF EXISTS `suggested_ideas`;
DROP TABLE IF EXISTS `research_jobs`;
-- Dropped in reverse creation order. There are no FK constraints between them in
-- this schema (the relationships are application-level integer references), so
-- order is a convention here rather than a requirement.


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — DROP THE ADDED COLUMNS   ⚠ DESTRUCTIVE, IRREVERSIBLE
--
-- Do not run this unless 0.2 showed post_deploy_scripts = 0, or you have
-- explicitly accepted the loss. Column data cannot be recovered by re-adding the
-- column; it comes back empty.
-- ───────────────────────────────────────────────────────────────────────────────

-- 2.1 Drop the variant indexes first. TiDB will drop them with the columns, but
--     doing it explicitly keeps the intent legible and the statement idempotent
--     across engines.
DROP INDEX `sfo_parent_idx`       ON `script_factory_outputs`;
DROP INDEX `sfo_variant_root_idx` ON `script_factory_outputs`;

-- 2.2 script_factory_outputs — remove the 14 added columns.
--     Listed in reverse order of addition, purely for readability against the
--     migration file.
ALTER TABLE `script_factory_outputs`
  DROP COLUMN `metric_version`,
  DROP COLUMN `section_history`,
  DROP COLUMN `generation_params`,
  DROP COLUMN `variant_of_root_id`,
  DROP COLUMN `variant_label`,
  DROP COLUMN `parent_script_id`,
  DROP COLUMN `pattern_composition`,
  DROP COLUMN `production_script_id`,
  DROP COLUMN `word_count`,
  DROP COLUMN `research_job_id`,
  DROP COLUMN `source_idea_id`,
  DROP COLUMN `target_length_minutes`,
  DROP COLUMN `analog_data_entry_ids`,
  DROP COLUMN `persona_id`;

-- 2.3 analog_data_entries — remove offer_profile.
ALTER TABLE `analog_data_entries`
  DROP COLUMN `offer_profile`;

-- 2.4 collective_sourcing_candidates — NOTHING TO DROP.
--
-- Section 4 of the migration is INTENTIONALLY EXCLUDED (owner decision: deferred to
-- a v2.5 micro-migration), so this deployment never adds `notes` or `updated_at` and
-- there is nothing here to reverse. The statement is kept commented for whenever the
-- v2.5 migration does run.
--
-- DEFERRED — matches the commented-out Section 4 in the migration file:
-- ALTER TABLE `collective_sourcing_candidates`
--   DROP COLUMN `updated_at`,
--   DROP COLUMN `notes`;


-- ───────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — VERIFY THE ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────────

-- 3.1 The three tables are gone.
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('research_jobs','suggested_ideas','topic_nodes');
-- EXPECT: empty result set.

-- 3.2 script_factory_outputs is back to 15 columns and none of the 13 remain.
SELECT COUNT(*) AS total_columns FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'script_factory_outputs';
-- EXPECT: 15.

SELECT COUNT(*) AS leftover_v22_columns FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'script_factory_outputs'
  AND column_name IN (
    'persona_id','analog_data_entry_ids','target_length_minutes','source_idea_id',
    'research_job_id','word_count','production_script_id','pattern_composition',
    'parent_script_id','variant_label','variant_of_root_id','generation_params',
    'section_history','metric_version'
  );
-- EXPECT: 0.

-- 3.3 THE ROWS AND THEIR SCRIPT BODIES SURVIVED. This is the check that matters —
--     the point of an additive migration is that a rollback loses metadata, never
--     the scripts themselves.
SELECT COUNT(*) AS total_rows,
       SUM(CASE WHEN script_body IS NULL OR script_body = '' THEN 1 ELSE 0 END) AS empty_bodies,
       MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM script_factory_outputs;
-- EXPECT: total_rows >= the pre-migration count (5 at time of writing).
--         empty_bodies = 0. If a body is empty, the rollback damaged data. STOP
--         and restore from backup.

-- 3.4 Table count is back where it started.
SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = DATABASE();
-- EXPECT: 146.

-- ═══════════════════════════════════════════════════════════════════════════════
-- END.
--
-- REMEMBER: rolling back the schema does NOT roll back the application. If the
-- new code is still deployed it will now fail on every Script Factory query,
-- because it selects columns that no longer exist. Roll back the CODE FIRST,
-- confirm the app is healthy on the previous build, and only then consider
-- touching the schema.
-- ═══════════════════════════════════════════════════════════════════════════════
