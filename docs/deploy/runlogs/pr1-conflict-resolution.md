# PR #1 conflict resolution — main merged INTO the branch

**main frozen at `216c2f2` by the repo owner for this window. Nothing pushed to main.**

Merge performed as `git merge origin/main` on `feature/script-factory-v22`, so all
conflicts resolve on the branch where they can be tested.

---

## Baselines captured BEFORE the merge

Measured on the branch at `ef85981`, so "no new errors" is a comparison against a
recorded number rather than a remembered one.

```
pnpm check : 22 errors  (7 TS7006, 7 TS2345, 5 TS2339, 1 TS2769, 1 TS2322, 1 TS18048)
pnpm test  : 33 failed | 1362 passed (1395)  across 14 files
```

---

## Conflict 1 — `drizzle/schema.ts`

One hunk, lines 3910–4206. Branch side declared the three Script Factory tables; main
side declared the four funnel tables. Resolved as a **strict union**: branch block kept
in place, main block appended after it, nothing dropped.

### Strict-union proof

```
resolved: 143 declarations   main: 140   branch: 139

in main   but MISSING from resolved:  (empty)
in branch but MISSING from resolved:  (empty)
```

All four funnel tables PRESENT: `interconnected_leads`, `kajabi_purchases`,
`kajabi_retry_queue`, `funnel_economics_scenarios`.
All three Script Factory tables PRESENT: `research_jobs`, `suggested_ideas`, `topic_nodes`.
All 15 added columns PRESENT on `scriptFactoryOutputs` / `analogDataEntries`.

**143 = 139 + 4**, which is the arithmetic the reviewer specified.

### A second divergence inside the same file, outside the conflict hunk

`git diff` against main showed 24 lines where the branch and main disagree *outside*
the marked conflict — git auto-merged them toward the branch. Those needed checking
rather than accepting, because an auto-merge is not a verdict.

They are the branch's **v2.2 declaration-only corrections**, and production confirms the
branch is right:

```
+----------------+--------------+-------------------------------------------------------+
| table_name     | column_name  | column_type                                           |
+----------------+--------------+-------------------------------------------------------+
| claims_reviews | content_type | varchar(64)                                           |
| claims_reviews | status       | enum('pending','approved','rejected','auto_approved') |
+----------------+--------------+-------------------------------------------------------+
```

main declares `mysqlEnum("cr_content_type", [...])`. **No such column exists live**, and
the real column is `varchar(64)`, not an enum. Keeping main's version there would
reintroduce a defect v2.2 fixed.

### One thing that contradicted the branch's own documentation

The branch's `schema.ts` header states these JSON-bearing columns are "physically
LONGTEXT, not MySQL json", proven by a probe reporting MISMATCHED 15/15. **Production
disagrees:**

```
claims_reviews.verdicts                  json
script_factory_outputs.corpus_entry_ids  json
script_factory_outputs.verified_pattern_ids json
yt_headline_generations.headlines        json
yt_headline_generations.thumbnail_concepts json
```

`column_type` reads `json`, not `longtext`. That probe ran against the **local MySQL dev
database**, not production, so the header's claim is true of dev and false of production.

This does not change the resolution, because `longtextJson` is safe either way — and its
own source says so explicitly:

```ts
fromDriver(value) {
  if (typeof value === "object") return value as TData;   // real JSON column: pass through
  ...
}
toDriver(value) { return JSON.stringify(value ?? null); } // valid JSON doc: accepted by json
```

> "Passes arrays/objects through untouched, so it is safe on any column that a future
> migration converts to a real JSON type."

So `longtextJson` works against both physical types, while main's `json()` breaks against
longtext. The branch side is the safe choice on both databases. **But the header comment
is misleading and should be corrected** — it will send the next reader looking for a
longtext column that isn't there.

---

## Conflict 2 — `server/_core/index.ts`

One hunk, lines 1930–1947. Branch side wrapped the upload watchdog in a `SANDBOX_MODE`
guard; main side added `startKajabiRetryWorker()`. Resolved by keeping **both**: the
guard, and the retry worker — with the retry worker given the same guard, because it
calls the real Kajabi API and would enroll real leads from a test environment.

```
route registrations — main: 69   resolved: 70
in main but MISSING from resolved: (empty)
RELATIVE ORDER PRESERVED
```

The one addition is the branch's `/api/scheduled/weekly-idea-generation`, appended after
main's routes. main's 69 registrations appear in the resolved file in exactly main's
order, verified by sequence comparison rather than by set membership.

---

## Verification

### `compare-live-vs-schema.mjs` — 9 tables against live production

```
script_factory_outputs live= 29  schema.ts= 29  SET-EQUAL
analog_data_entries    live= 11  schema.ts= 11  SET-EQUAL
research_jobs          live= 16  schema.ts= 16  SET-EQUAL
suggested_ideas        live= 20  schema.ts= 20  SET-EQUAL
topic_nodes            live= 14  schema.ts= 14  SET-EQUAL
interconnected_leads   live= 24  schema.ts= 24  SET-EQUAL
kajabi_purchases       live= 11  schema.ts= 11  SET-EQUAL
kajabi_retry_queue     live= 10  schema.ts= 10  SET-EQUAL
funnel_economics_scenarios live= 14  schema.ts= 14  SET-EQUAL

9 table(s) compared, 0 mismatch(es).   EXIT: 0
```

The four funnel tables coming back SET-EQUAL is the proof the reviewer asked for: the
union preserved main's declarations intact, matching the live tables that hold 795 + 18 +
2 rows.

### `verify-column-names.mjs`

```
columns printed: 65   UNRESOLVED: 0   NOT FOUND: 0   SET MISMATCHES: 0
EXIT: 0
```

### `pnpm check` — 35 errors, and every new one is main's

```
branch alone : 22
main alone   : 36
merged       : 35
```

13 errors are new relative to the branch baseline. All 13 were verified present on
`origin/main` alone, in a detached worktree:

```
new errors NOT found on main alone (would be MY fault): (empty)
```

They are in files that arrived from main — `funnelReconciliationRouter.ts`,
`funnelEconomicsRouter.ts`, `attributionRouter.ts`, `abSignificanceWatchdog.ts`,
`InterconnectedThankYou*.tsx`. **Zero errors are attributable to the resolution.**

The merge also *fixed* 14 of main's 36, all schema-related — main's own broken
declarations that the branch's v2.2 corrections repair:

```
client/src/pages/CorpusBuilder.tsx(132,34)   TS7006
server/patternExtractorRouter.ts(99,65)      TS2345
server/transcriptRouter.ts(331,50)           TS2339
server/transcriptRouter.ts(331,66)           TS2339
... (14 total)
```

Two of main's errors deserve flagging because they are not merely noisy:
`attributionRouter.ts` cannot resolve `'../shopify'` or `'../../drizzle/schema'` (TS2307).
Those are missing-module errors on `main` itself.

### `pnpm test` — 35 failed, and both new failures are main's

```
baseline: 33 failed | 1362 passed  (14 files)
merged  : 35 failed | 1360 passed  (15 files)
```

The two new failures:

```
server/metaAdPush.test.ts > AD_CATALOG > should have correct image file naming convention
server/metaAdPush.test.ts > AD_CATALOG > should have variant numbers 1-6 (KBMO 1-5 + Interconnected 6)
```

Run against `origin/main` alone: **`2 failed | 9 passed`** — the identical two tests. main
extended `AD_CATALOG` with an Interconnected variant and its own assertions no longer
match. Pre-existing. No baseline failure started passing, and none stopped.

---

## Drift audit — main's 80 commits vs production

Reviewer's question: did anyone apply DDL outside our process, and does main expect
anything the database lacks?

**Table level: no drift.** All 143 declared tables exist live (149 total tables).

**Column level:** `scripts/audit-main-schema-drift.mjs` compares every declared column
against live, in both directions.

```
TOTAL MISSING IN DB : 8    <- app expects, DB lacks
TOTAL EXTRA IN DB   : 81   <- DB has, app ignores
```

### The 8 "missing in DB" are pre-existing on BOTH sides

```
apollo_sync_runs          asr_status
reddit_conversions        redditAttributionType
retreat_events            retreat_status
youtube_pipeline_videos   yt_status
collective_sourcing_candidates   status, notes, created_at, updated_at
```

Each checked against both branches: present in main's schema.ts AND the branch's. Not
introduced by the merge. These are part of the **35 drift pairs** the plan already
documents as pre-existing (Part 6, note 6: "This deploy does not make them worse, and
does not make them better").

The four on `collective_sourcing_candidates` are exactly why **Section 4 was deferred to
v2.5** — live has `csc_status`, `csc_createdAt`, `imported_at`, `reviewed_at` where the
declaration says `status`, `created_at`, `notes`, `updated_at`. Deliberately not touched.

### The 4 funnel tables were created outside the migration process

They exist live with data but `main` adds **no migration file** — only `schema.ts` edits.
The commit log confirms it: *"DB migration applied via ALTER TABLE"*. Someone ran DDL by
hand. `__drizzle_migrations` reports **114 applied**, and it does not record those changes.

This is not a defect to fix here, but it is the reason a drift audit is worth having in
the repo rather than as a one-off: the schema file and the database can diverge silently
in either direction, and nothing currently catches it.

---

## State

| Item | Value |
|---|---|
| main | `216c2f2` — **frozen, untouched** |
| Merge | staged on the branch, **not committed** |
| Conflicts | 2, both resolved |
| Conflict markers in tree | 0 |
| Declarations | 143 |
| Verifications | 4 run, all consistent with baseline |

Stopped before merging to main, per instruction.
