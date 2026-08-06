# Gate 2 / Section 2 — 14 columns + 2 indexes, PASSED

**Run:** 2026-08-06 17:4x–17:5x UTC against production
`gateway02.us-east-1.prod.aws.tidbcloud.com:4000` / `iUgsiz76NwfDUVHZHV7CyJ`

## APPROVED DEVIATION — statement boundaries only

The migration file declares Section 2 as **one** `ALTER TABLE` with 14 `ADD COLUMN`
clauses (lines 225–255). The reviewer approved splitting it into **14 separate
`ADD COLUMN` statements**.

- **DDL content: identical** to the reviewed file.
- **Statement boundaries: changed** — 1 statement becomes 14.
- **Rationale:** a 14-column `ALTER` that fails partway leaves an ambiguous partial
  state. Fourteen statements localise any failure to a named column, with the
  preceding ones already verified.

The split was **audited against the file before execution**, not asserted:

```
file: 14   mine: 14   expected: 14
diff /tmp/file_cols.txt /tmp/my_cols.txt  →  IDENTICAL
diff /tmp/file_order.txt /tmp/my_order.txt →  ORDER IDENTICAL
```

Both the (name, type) pairs and the execution order match the file exactly. The runner is
committed as `scripts/run-section2-split.sh` so the boundaries are auditable rather than
ephemeral shell history.

## Execution — 14 statements, each read back before the next

All 14 returned `exit=0`. The runner was written to **halt** on a non-zero exit, on any
`ERROR` in output, on a column failing to read back, or on a column reporting `NO` for
nullability. None of those triggered.

| pos | column | type | nullable | charset |
|---|---|---|---|---|
| 16 | `persona_id` | int | YES | – |
| 17 | `analog_data_entry_ids` | longtext | YES | utf8mb4 |
| 18 | `target_length_minutes` | int | YES | – |
| 19 | `source_idea_id` | int | YES | – |
| 20 | `research_job_id` | int | YES | – |
| 21 | `word_count` | int | YES | – |
| 22 | `production_script_id` | int | YES | – |
| 23 | `pattern_composition` | longtext | YES | utf8mb4 |
| 24 | `parent_script_id` | int | YES | – |
| 25 | `variant_label` | varchar(120) | YES | utf8mb4 |
| 26 | `variant_of_root_id` | int | YES | – |
| 27 | `generation_params` | longtext | YES | utf8mb4 |
| 28 | `section_history` | longtext | YES | utf8mb4 |
| 29 | `metric_version` | varchar(16) | YES | utf8mb4 |

Ordinal positions 16–29 are contiguous — the columns landed in the file's order, and
nothing was inserted between them.

```
not_nullable_count: 0        -- EXPECT 0
```

All six text-bearing columns report `utf8mb4` / `utf8mb4_bin`:
`analog_data_entry_ids`, `generation_params`, `metric_version`, `pattern_composition`,
`section_history`, `variant_label`.

## Column count

```
+-------------+
| columns_now |
+-------------+
|          29 |
+-------------+
```

**15 → 29, exactly +14.**

## Indexes — run individually, read back from information_schema.statistics

```
+----------------------+--------------------+------------+
| index_name           | cols               | non_unique |
+----------------------+--------------------+------------+
| PRIMARY              | id                 | 0          |
| idx_created_at       | created_at         | 1          |
| idx_format           | format             | 1          |
| idx_status           | status             | 1          |
| sfo_parent_idx       | parent_script_id   | 1          |
| sfo_variant_root_idx | variant_of_root_id | 1          |
+----------------------+--------------------+------------+
```

Both new indexes present on the correct columns. The three pre-existing indexes
(`idx_format`, `idx_status`, `idx_created_at`) and `PRIMARY` are intact — nothing was
displaced.

## The 5 existing rows — intact, all new columns NULL

```
rows_total              5
empty_bodies            0
null_metric_version     5
null_generation_params  5
null_persona_id         5
null_word_count         5
null_section_history    5
null_parent_script_id   5
null_variant_label      5
null_variant_of_root_id 5

null_analog_ids   5   null_target_len    5   null_source_idea  5
null_research_job 5   null_prod_script   5   null_pattern_comp 5
```

**All 14 new columns read NULL on all 5 rows. `empty_bodies = 0`.**

Original 15 columns unchanged, cross-checked against the backup taken before any DDL:

```
+----+----------------------------------------------+------------+-------+-------+-----+----------+
| id | title                                        | body_bytes | vc    | te    | pct | status   |
+----+----------------------------------------------+------------+-------+-------+-----+----------+
|  1 | Beyond "Normal" Labs: The Hidden Truth About |       6053 |    20 |    29 |  69 | draft    |
|  2 | Stop Whac-A-Mole: Uncover Root Causes of Chr |       5211 |    25 |    34 |  74 | approved |
|  3 | Beyond "Normal" Labs: Uncovering Hidden Heal |       6835 |    24 |    34 |  71 | draft    |
|  4 | Stop Playing Whac-A-Mole: End Fatigue & Brai |       4876 |    23 |    33 |  70 | draft    |
|  5 | Reclaim Your Rest: The Gut-Sleep Connection  |       5786 |    25 |    37 |  68 | draft    |
+----+----------------------------------------------+------------+-------+-------+-----+----------+
```

Byte lengths `6053 / 5211 / 6835 / 4876 / 5786` and percentages `69 / 74 / 71 / 70 / 68`
are **identical to the pre-migration backup**. Row 2's `status='approved'` is also
preserved — worth noting because it is the only non-draft row and therefore the one whose
alteration would be least visible in a count-only check.

## `metric_version` — NULL, deliberately not backfilled

```
+----+----------------+------------------+
| id | metric_version | verification_pct |
+----+----------------+------------------+
|  1 | <NULL>         |               69 |
|  2 | <NULL>         |               74 |
|  3 | <NULL>         |               71 |
|  4 | <NULL>         |               70 |
|  5 | <NULL>         |               68 |
+----+----------------+------------------+
```

`null_metric_version = 5`. These percentages were computed under the **pre-v2.2**
definition — the share of bracketed markers that were `[VERIFIED]`. Stamping them
`'v2.2-instance'` would relabel a marker-ratio number as a section-ratio number and make
the column lie about precisely the rows it exists to disambiguate. NULL reads as
"pre-v2.2, not comparable", which is the truthful value.

## Live vs schema.ts — all four migrated tables

```
script_factory_outputs live= 29  schema.ts= 29  SET-EQUAL
research_jobs          live= 16  schema.ts= 16  SET-EQUAL
suggested_ideas        live= 20  schema.ts= 20  SET-EQUAL
topic_nodes            live= 14  schema.ts= 14  SET-EQUAL

4 table(s) compared, 0 mismatch(es).   EXIT: 0
```

`script_factory_outputs` is the meaningful addition here: schema.ts declares all 29
columns for this table, live production now has all 29, and the sets are equal. The
app's declared shape and the database's actual shape agree.

## Verdict

Section 2 passes on every check. Stopping for reviewer word before Section 3.
