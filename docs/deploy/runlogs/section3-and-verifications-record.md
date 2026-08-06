# Gate 2 / Section 3 + Nine Verifications + Final Sweep — ALL PASSED

**Run:** 2026-08-06 18:0x UTC against production
`gateway02.us-east-1.prod.aws.tidbcloud.com:4000` / `iUgsiz76NwfDUVHZHV7CyJ`

---

## Section 3 — `analog_data_entries.offer_profile`

Single statement, exactly as written in the file (lines 274–275). No split, no deviation.

Pre-check: `offer_profile_exists = 0`, `columns_before = 10`, `rows_before = 1`.
The column was genuinely absent, so this was a real add rather than a silent no-op.

```
+------+---------------+-------------+-------------+---------+----------------+-------------+
| pos  | column_name   | column_type | is_nullable | charset | collation_name | col_default |
+------+---------------+-------------+-------------+---------+----------------+-------------+
|   11 | offer_profile | text        | YES         | utf8mb4 | utf8mb4_bin    | NULL        |
+------+---------------+-------------+-------------+---------+----------------+-------------+

rows_after: 1    null_offer_profile: 1
```

Indexes on `analog_data_entries` after the change: `PRIMARY (id)` only. Section 3 declares
no indexes and none appeared.

This is the column that binds a script to a real offer. Without it every generation runs
with a null offer profile and the v2.4 sell-density lint reports `not_applicable` rather
than `passed` — which matters for the Gate 4 smoke test.

---

## The nine verifications, run verbatim

### 5.1 — three tables exist
```
research_jobs    utf8mb4_bin
suggested_ideas  utf8mb4_bin
topic_nodes      utf8mb4_bin
```
3 rows, collation `utf8mb4_*`. **PASS**

### 5.2 — column counts
```
research_jobs     16
suggested_ideas   20
topic_nodes       14
```
**PASS**

### 5.3 — 14 columns with correct types
14 rows, every `is_nullable = YES`. `longtext` + utf8mb4 on the four JSON-carrying
columns; `variant_label varchar(120)`, `metric_version varchar(16)`, remaining eight
`int` with `character_set_name = NULL` (correct — integers have no charset).
**No latin1 anywhere.** **PASS**

### 5.4 — five rows intact
```
+------------+-----------------+-------------+---------------------+--------------+
| total_rows | null_gen_params | null_parent | null_metric_version | empty_bodies |
+------------+-----------------+-------------+---------------------+--------------+
|          5 |               5 |           5 |                   5 |            0 |
+------------+-----------------+-------------+---------------------+--------------+
```
`total_rows` matches pre-flight 0.4. Every null count equals `total_rows`.
`empty_bodies = 0` — no existing data damaged. **PASS**

### 5.5 — offer_profile and the one row
```
rows_total: 1    null_offer_profile: 1
```
**PASS**

### 5.6 — indexes created
11 rows, exactly as the EXPECT requires:
```
research_jobs           research_jobs_status_idx
research_jobs           research_jobs_topic_idx
script_factory_outputs  sfo_parent_idx
script_factory_outputs  sfo_variant_root_idx
suggested_ideas         suggested_ideas_batch_idx
suggested_ideas         suggested_ideas_created_idx
suggested_ideas         suggested_ideas_status_idx
suggested_ideas         suggested_ideas_week_idx
topic_nodes             topic_nodes_parent_idx
topic_nodes             topic_nodes_path_idx
topic_nodes             topic_nodes_status_idx

count: 11
```
**PASS**

### 5.7 — charset assertion (read-only)
34 rows returned, **every one `utf8mb4` / `utf8mb4_bin`**. Asserted numerically as well:

```
non_utf8mb4_columns: 0
```

**PASS.** Note this version of 5.7 reads the catalogue rather than performing the write
probe an earlier draft used — that probe would have failed on a healthy migration, because
`analog_data_entries.content` is `NOT NULL` with no default, and it wrote junk into the
table where the sales page lives. The whole migration file performs no data mutation of
any kind.

### 5.8 — nothing dropped
```
table_count: 149
```
**PASS.** Re-measured fresh after Section 3 rather than inheriting the post-Section-1
reading, per reviewer instruction. Also confirmed 149 counting base tables only, so the
figure is not inflated by views (this schema has none).

### 5.9 — no data written
```
+----------+----------+---------+---------+---------+
| sfo_rows | ade_rows | rj_rows | si_rows | tn_rows |
+----------+----------+---------+---------+---------+
|        5 |        1 |       0 |       0 |       0 |
+----------+----------+---------+---------+---------+
```
**PASS**

**Nine verifications, nine passes.**

---

## Final integrity sweep

### Row counts vs pre-migration baseline
```
+--------------------------------+----------+----------+
| tbl                            | rows_now | baseline |
+--------------------------------+----------+----------+
| script_factory_outputs         |        5 |        5 |
| analog_data_entries            |        1 |        1 |
| collective_sourcing_candidates |        0 |        0 |
| research_jobs (new)            |        0 |        0 |
| suggested_ideas (new)          |        0 |        0 |
| topic_nodes (new)              |        0 |        0 |
+--------------------------------+----------+----------+

tables_with_drift: 0
```

### Section 4 exclusion held
`collective_sourcing_candidates` has **19 columns** — unchanged. Section 4 is marked
INTENTIONALLY EXCLUDED — DO NOT RUN, and it was not run. Worth asserting rather than
assuming: the file contains that DDL, so "we didn't run it" is a claim that can be checked.

### schema.ts ≡ SQL ≡ live, all five tables
```
script_factory_outputs live= 29  schema.ts= 29  SET-EQUAL
analog_data_entries    live= 11  schema.ts= 11  SET-EQUAL
research_jobs          live= 16  schema.ts= 16  SET-EQUAL
suggested_ideas        live= 20  schema.ts= 20  SET-EQUAL
topic_nodes            live= 14  schema.ts= 14  SET-EQUAL

5 table(s) compared, 0 mismatch(es).
```

### Checker still green at HEAD
```
verify-column-names.mjs EXIT: 0
columns printed: 65   UNRESOLVED: 0   NOT FOUND: 0   SET MISMATCHES: 0
```

---

## Gate 2 verdict

**Migration complete. 17 DDL statements, all successful, all read back.**

| Section | Statements | Result |
|---|---|---|
| 0 | 4 SELECTs | PASS |
| 1 | 3 CREATE TABLE + 9 CREATE INDEX | PASS |
| 2 | 14 ADD COLUMN (approved split) + 2 CREATE INDEX | PASS |
| 3 | 1 ADD COLUMN | PASS |
| 4 | — | correctly not run |
| 5 | 9 verifications | 9/9 PASS |

No rollback required. Stopping for reviewer word before Gate 3. **Gate 3 opens on the
reviewer's word, not on green verifications.**
