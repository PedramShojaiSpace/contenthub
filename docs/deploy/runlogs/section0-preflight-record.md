# Gate 2 / Section 0 — Pre-flight, PASSED

**Run:** 2026-08-06 17:13–17:15 UTC
**Target confirmed as PRODUCTION** (inverse guard — asserting it IS production):

```
expected host: gateway02.us-east-1.prod.aws.tidbcloud.com
actual   host: gateway02.us-east-1.prod.aws.tidbcloud.com
HOST: MATCHES PRODUCTION
expected db  : iUgsiz76NwfDUVHZHV7CyJ
actual   db  : iUgsiz76NwfDUVHZHV7CyJ
DB:   MATCHES PRODUCTION
```

All four pre-flight checks are read-only `SELECT`s. **No DDL has executed.**

## 0.1 — Database and engine

```
+------------------------+-------------------------------+-----------+-------------+
| current_db             | server_version                | cs_server | coll_server |
+------------------------+-------------------------------+-----------+-------------+
| iUgsiz76NwfDUVHZHV7CyJ | 8.0.11-TiDB-v8.5.3-serverless | utf8mb4   | utf8mb4_bin |
+------------------------+-------------------------------+-----------+-------------+
```

EXPECT: db = `iUgsiz76NwfDUVHZHV7CyJ`, version contains "TiDB", cs_server = utf8mb4.
**PASS on all three.** Confirms the plan's charset note: utf8mb3 emoji truncation was
a sandbox-only risk and does not exist here.

## 0.2 — Three target tables absent

Empty result set. Because "empty" and "not run" look identical in a batch log, this was
re-asserted as an explicit count:

```
+-----------------------+
| matching_tables_found |
+-----------------------+
|                     0 |
+-----------------------+
```

EXPECT: 0. **PASS.** A `LIKE`-based sweep for near-miss names returned only unrelated
pre-existing tables (`research_reports`, `research_queries`,
`research_competitor_mentions`, `kids_researchers`, `viral_topics`) — no collisions with
`research_jobs`, `suggested_ideas`, `topic_nodes`.

## 0.3 — None of the 14 new columns already exist

```
+---------------------------+
| existing_v22_plus_columns |
+---------------------------+
|                         0 |
+---------------------------+
```

EXPECT: 0. **PASS.** This is the check whose IN-list was corrected in review round 2 —
`metric_version` was missing, which would have left that one column unguarded while the
result still read 0. The list now carries all 14.

Current shape confirmed independently:

```
+-----------------+
| current_columns |
+-----------------+
|              15 |
+-----------------+
```

15 columns = the pre-v2.2 shape the migration expects. After Section 2 this must read 29.

## 0.4 — Row counts before migration

```
+--------------------------------+-------------+
| tbl                            | rows_before |
+--------------------------------+-------------+
| script_factory_outputs         |           5 |
| analog_data_entries            |           1 |
| collective_sourcing_candidates |           0 |
+--------------------------------+-------------+
```

EXPECT: 5 / 1 / 0. **PASS.** Identical to the values in the backup, so the dump and the
migration target are the same state.

## Additional baselines captured for later verification

| Baseline | Value | Used by |
|---|---|---|
| Total base tables | **146** | 5.8 — must become exactly 149 |
| `script_factory_outputs` columns | **15** | 5.2 / 5.3 — must become 29 |
| `analog_data_entries.offer_profile` | **absent (0)** | Section 3 guard |

## Verdict

Section 0 passes on every EXPECT. Stopping here for reviewer word before Section 1.
