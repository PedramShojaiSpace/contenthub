-- ─── v2.3 Part 3 — section-level undo trail ──────────────────────────────────
--
-- `regenerateSection` replaces ONE section inside script_body in place, rather
-- than creating a variant row. That is the right shape for "fix this hook" — the
-- operator wants the script they already approved, with a better hook, not a
-- second script to reconcile — but it means the previous wording would otherwise
-- be destroyed with no way back.
--
-- ADDITIVE and NULLABLE, like 0126. Every existing row keeps NULL, which reads
-- correctly as "no section has been regenerated on this script". No backfill.
--
-- No FK, no cascade, consistent with the rest of this table on this live db.
--
-- The 10-entry cap is enforced in application code, not here: MySQL cannot bound
-- a JSON array's length, and a trigger would put a second definition of the cap
-- somewhere the router cannot see.
ALTER TABLE `script_factory_outputs`
  ADD COLUMN `section_history` LONGTEXT NULL;

