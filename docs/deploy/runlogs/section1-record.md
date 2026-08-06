# Gate 2 / Section 1 — Three new tables, PASSED

**Run:** 2026-08-06 17:2x–17:3x UTC against production
`gateway02.us-east-1.prod.aws.tidbcloud.com:4000` / `iUgsiz76NwfDUVHZHV7CyJ`

**12 statements, executed one at a time.** Every one returned clean; no statement
produced output, which for DDL is the success signal.

## Index form — the reviewer's concern was well founded

The indexes in this file are **separate `CREATE INDEX` statements**, not inline `KEY`
clauses inside `CREATE TABLE`. Confirmed by reading lines 153–154, 181–184, 205–207.
A table could therefore exist complete while its indexes silently did not. Nine
`CREATE INDEX` statements total (2 + 4 + 3), each run and each read back.

| # | Statement |
|---|---|
| 1 | `CREATE TABLE research_jobs` |
| 2–3 | 2 × `CREATE INDEX` on `research_jobs` |
| 4 | `CREATE TABLE suggested_ideas` |
| 5–8 | 4 × `CREATE INDEX` on `suggested_ideas` |
| 9 | `CREATE TABLE topic_nodes` |
| 10–12 | 3 × `CREATE INDEX` on `topic_nodes` |

## Column counts — read back from information_schema

| Table | Expected | Actual |
|---|---|---|
| `research_jobs` | 16 | **16** |
| `suggested_ideas` | 20 | **20** |
| `topic_nodes` | 14 | **14** |

All three report `table_collation = utf8mb4_bin`.

## Indexes — read back from information_schema.statistics

```
research_jobs
+--------------------------+-----------------+------------+
| index_name               | cols            | non_unique |
+--------------------------+-----------------+------------+
| PRIMARY                  | id              | 0          |
| research_jobs_status_idx | research_status | 1          |
| research_jobs_topic_idx  | topic           | 1          |
+--------------------------+-----------------+------------+

suggested_ideas
+-----------------------------+-------------+------------+
| PRIMARY                     | id          | 0          |
| suggested_ideas_batch_idx   | batch_id    | 1          |
| suggested_ideas_created_idx | created_at  | 1          |
| suggested_ideas_status_idx  | idea_status | 1          |
| suggested_ideas_week_idx    | week_label  | 1          |
+-----------------------------+-------------+------------+

topic_nodes
+------------------------+--------------+------------+
| PRIMARY                | id           | 0          |
| topic_nodes_parent_idx | parent_id    | 1          |
| topic_nodes_path_idx   | path         | 1          |
| topic_nodes_status_idx | topic_status | 1          |
+------------------------+--------------+------------+
```

**All 9 named indexes present, on the correct columns, plus 3 PRIMARY keys.**
No TiDB divergence on index creation.

## `longtext` confirmations — the JSON-vs-longtext correction held

```
+-----------------+----------------------+-----------+--------------------+----------------+
| table_name      | column_name          | data_type | character_set_name | collation_name |
+-----------------+----------------------+-----------+--------------------+----------------+
| research_jobs   | outlier_videos       | longtext  | utf8mb4            | utf8mb4_bin    |
| research_jobs   | pattern_ids          | longtext  | utf8mb4            | utf8mb4_bin    |
| research_jobs   | structure_summary    | longtext  | utf8mb4            | utf8mb4_bin    |
| research_jobs   | transcript_video_ids | longtext  | utf8mb4            | utf8mb4_bin    |
| suggested_ideas | recommended_patterns | longtext  | utf8mb4            | utf8mb4_bin    |
| suggested_ideas | vidiq_data           | longtext  | utf8mb4            | utf8mb4_bin    |
| topic_nodes     | vidiq_data           | longtext  | utf8mb4            | utf8mb4_bin    |
+-----------------+----------------------+-----------+--------------------+----------------+

json_columns_found: 0
```

Seven `longtext` columns, zero `json` columns across all three tables. Had these been
created as `JSON` (as drizzle/0124 and 0125 declared them), the database would validate
and reject input the app expects to write as plain text — the failure would appear at the
database boundary, not at typecheck.

## Enum members and defaults — verified live

This is the subject matter of the `.default()` resolver bug, so it is worth reading
directly from production rather than from the artifact:

```
+-----------------+-------------------+--------------------------------------------------------+-----------------+
| table_name      | column_name       | column_type                                            | column_default  |
+-----------------+-------------------+--------------------------------------------------------+-----------------+
| research_jobs   | research_status   | enum('pending','researching_outliers',                 | pending         |
|                 |                   |      'fetching_transcripts','extracting_patterns',     |                 |
|                 |                   |      'complete','failed')                              |                 |
| suggested_ideas | idea_source       | enum('weekly_auto','manual_generate','manual')          | manual_generate |
| suggested_ideas | idea_status       | enum('suggested','shortlisted','dismissed','generated') | suggested       |
| topic_nodes     | topic_source_type | enum('analog_extraction','llm_expansion','manual')      | manual          |
| topic_nodes     | topic_status      | enum('active','archived')                               | active          |
+-----------------+-------------------+--------------------------------------------------------+-----------------+
```

`idea_source` has the **3-member** enum from schema.ts, not 0124's 2-member version.
`topic_status` and `last_mined_at` exist despite being absent from 0125. The
column names are the SQL names (`research_status`, `idea_source`, …) and the defaults
are the default literals (`pending`, `manual_generate`, …) — exactly the pair the broken
checker conflated, now confirmed distinct in the live database.

```
+---------------+--------------+----------------+
| column_name   | column_type  | column_default |
+---------------+--------------+----------------+
| path          | varchar(255) |                |
| depth         | int          | 0              |
| last_mined_at | datetime     | NULL           |
+---------------+--------------+----------------+
```

`topic_nodes.path` carries the empty-string default — the same `.default("")` that
resolved to a blank name in the broken checker. Correct here.

## Table count

```
+------------+
| tables_now |
+------------+
|        149 |
+------------+
```

**146 → 149, exactly +3.** Nothing was dropped.

## Existing data untouched

```
+--------------------------------+---+
| script_factory_outputs         | 5 |
| analog_data_entries            | 1 |
| collective_sourcing_candidates | 0 |
| research_jobs (new)            | 0 |
| suggested_ideas (new)          | 0 |
| topic_nodes (new)              | 0 |
+--------------------------------+---+
```

## Independent cross-check: live vs schema.ts

`scripts/verify-column-names.mjs` compares the migration SQL against schema.ts. It does
not read production. So the live result was compared to schema.ts directly via a new
`scripts/compare-live-vs-schema.mjs`:

```
research_jobs        live= 16  schema.ts= 16  SET-EQUAL
suggested_ideas      live= 20  schema.ts= 20  SET-EQUAL
topic_nodes          live= 14  schema.ts= 14  SET-EQUAL

3 table(s) compared, 0 mismatch(es).   EXIT: 0
```

The chain is now closed end to end: **schema.ts ≡ migration SQL ≡ live production.**

## Verdict

Section 1 passes on every check. Stopping for reviewer word before Section 2.
