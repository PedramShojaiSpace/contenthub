-- Script Factory v2.3 Part 2 — variant lineage
--
-- Additive only: four nullable columns on script_factory_outputs plus two
-- indexes. No renames, no drops, no enum changes, no data rewritten. Safe to
-- apply to a live database while it is serving traffic.
--
-- Backfill is intentionally a no-op. Every row that exists today is an original,
-- and an original is exactly a row with parent_script_id IS NULL — which is what
-- ADD COLUMN ... NULL already gives them. Writing an explicit UPDATE to set
-- NULLs to NULL would only create the impression that originals were migrated
-- into some new state. They were not; the new columns simply describe them
-- correctly by default.
--
-- variant_of_root_id stores NULL on originals rather than their own id, so the
-- family key is COALESCE(variant_of_root_id, id). See the comment on the column
-- in drizzle/schema.ts for why self-id was rejected.

ALTER TABLE `script_factory_outputs`
  ADD COLUMN `parent_script_id` INT NULL,
  ADD COLUMN `variant_label` VARCHAR(120) NULL,
  ADD COLUMN `variant_of_root_id` INT NULL,
  ADD COLUMN `generation_params` LONGTEXT NULL;

-- Grouped Library listing filters originals with `parent_script_id IS NULL` and
-- then fetches each family's children; both halves hit these.
CREATE INDEX `idx_sfo_parent` ON `script_factory_outputs` (`parent_script_id`);
CREATE INDEX `idx_sfo_variant_root` ON `script_factory_outputs` (`variant_of_root_id`);

