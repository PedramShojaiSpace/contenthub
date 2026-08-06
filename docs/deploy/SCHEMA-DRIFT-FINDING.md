# Schema drift: the database and the schema file diverge silently, in both directions

**Status:** finding only. Nothing here was changed as part of the v2.4 deploy.
**For:** the owner conversation, not for immediate action.
**Discovered:** 2026-08-06, while resolving PR #1 against `main`.
**Evidence:** `scripts/audit-main-schema-drift.mjs`, output in
`docs/deploy/runlogs/drift-audit-output.txt`.

---

## The short version

`drizzle/schema.ts` is the app's declaration of what the database looks like.
Production is the database. **They disagree in 89 places**, and nothing in the
repository detects this. The v2.4 deploy neither caused nor worsened it — but the
deploy is how it came to light, and the same blind spot will hide the next
divergence too.

```
tables declared in schema.ts : 143   (all 143 exist live — no table-level drift)
live tables                  : 149

TOTAL MISSING IN DB : 8    <- app expects a column the database lacks
TOTAL EXTRA IN DB   : 81   <- database has a column the app does not declare
```

The two directions fail differently, which is why the audit reports them separately:

| Direction | What it means | Severity |
|---|---|---|
| **MISSING IN DB** | A query referencing that column fails at runtime | Breaks features |
| **EXTRA IN DB** | Drizzle ignores it; data may accumulate unread | Silent, but signals process failure |

---

## Finding 1 — DDL is being applied by hand, with no migration file

Four tables were added to `main` during the v2.4 window:

```
interconnected_leads         795 rows
kajabi_purchases              18 rows
kajabi_retry_queue             2 rows
funnel_economics_scenarios     0 rows
```

All four exist in production with live data. All four are declared in
`main`'s `schema.ts`. **None of them has a migration file.** `main`'s 80 commits
touch `drizzle/schema.ts` and nothing else under `drizzle/`:

```
$ git diff --stat 08c6efe origin/main -- drizzle/
 drizzle/schema.ts | 101 +++++++++++++++++++++++++++++-
 1 file changed, 99 insertions(+), 2 deletions(-)
```

A commit message states the method outright: *"DB migration applied via ALTER TABLE."*
Someone connected to production and ran DDL by hand.

That is not reckless in itself — it is how the four tables came to exist and the
funnel works. The problem is what it leaves behind: **no record**.

---

## Finding 2 — `__drizzle_migrations` does not know

```
+--------------------+
| applied_migrations |
+--------------------+
|                114 |
+--------------------+
```

The migrations table records 114 applied migrations. It does not record the four
funnel tables, because they never passed through a migration. It also does not
record the v2.4 changes, because v2.4 was applied as hand-written SQL by design
(`docs/deploy/v24-production-migration.sql`, executed statement-by-statement under
the gated process).

So the migrations table is **not** a reliable history of the schema. Anyone who
trusts it to answer "what shape is the database in?" gets a wrong answer, and gets
it confidently.

---

## Finding 3 — 81 columns exist in production that the app never declares

A sample, from the full output:

```
email_sequences       (declared 19 / live 29)
   EXTRA IN DB: email1_sent_at, email1_thread_id, email2_send_at, email2_sent_at,
                email2_thread_id, email3_send_at, email3_sent_at, email3_thread_id,
                funnel_id, send_error

kajabi_live_sessions  (declared 18 / live 27)
   EXTRA IN DB: best_clip_end, best_clip_reason, best_clip_start, buffer_channel_ids,
                buffer_pushed_at, recording_url, s3_key, share_post_draft, transcript

va_tasks              (declared 14 / live 18)
   EXTRA IN DB: category, channel, priority, status
```

These are harmless to the running app — Drizzle simply doesn't select them. But
`email_sequences` having ten undeclared columns including `send_error` and three
`*_sent_at` timestamps suggests a feature that was built, deployed, and then
partially forgotten in the schema file. Data may be accumulating in columns no
code reads.

Many of the 81 are also **the other half of a naming mismatch**: the app declares
`asr_status` while the database has `status`; the app declares
`redditAttributionType` while the database has `attributionType`. Those pairs
appear in both totals at once.

---

## Finding 4 — 8 columns the app expects and the database lacks

```
apollo_sync_runs                asr_status
reddit_conversions              redditAttributionType
retreat_events                  retreat_status
youtube_pipeline_videos         yt_status
collective_sourcing_candidates  status, notes, created_at, updated_at
```

**All 8 pre-date v2.4 and exist on both `main` and the feature branch.** Each was
checked against both branches' `schema.ts` independently. They are part of the
35 drift pairs the deploy plan already documents (Part 6, note 6: *"This deploy
does not make them worse, and does not make them better. They are pre-existing."*).

The four on `collective_sourcing_candidates` are precisely why **Section 4 of the
v2.4 migration was deferred to v2.5**: live has `csc_status`, `csc_createdAt`,
`imported_at`, `reviewed_at` where the declaration says `status`, `created_at`,
`notes`, `updated_at`. Reconciling that needs a decision about which name wins,
which is a product question, not a migration question.

---

## Finding 5 — the audit exists but is wired into nothing

`scripts/audit-main-schema-drift.mjs` was written during PR #1 resolution and is
committed. It is not called by any script in `package.json`, any test, or any CI
workflow — **there is no CI in this repository at all** (no `.github/workflows/`).
It runs only when a human remembers to run it.

The same is true of the two other verification scripts built during this work:

| Script | Checks | Wired in? |
|---|---|---|
| `verify-column-names.mjs` | migration SQL ≡ schema.ts column names | No |
| `compare-live-vs-schema.mjs` | schema.ts ≡ live production, per table | No |
| `audit-main-schema-drift.mjs` | every declared column vs live, both directions | No |

All three exit non-zero on failure, so all three are CI-ready as written. None is
in a pipeline.

---

## Why this is worth the owner's attention

The v2.4 process caught real defects — a verification table that printed default
literals instead of column names, a `CONFLICTING` PR that would have deleted four
live tables' declarations, a `--single-transaction` dump that exited 2 after one
table. Every one of those was caught by **a human reading output**, not by tooling
raising an alarm.

Schema drift is the same shape of problem: it is invisible until something breaks,
and by then the divergence is months old and nobody remembers which side is right.
The four funnel tables are a live example — they work, they hold 815 rows, and the
only reason we know how they were created is a commit message.

### Cheapest first step

Add a `verify` script to `package.json` that runs all three checks, and a minimal
GitHub Actions workflow that calls it on pull requests. That converts three scripts
nobody runs into a gate that fails loudly. It does not require fixing the 89
existing divergences — the audit can be run in report-only mode until the backlog
is triaged.

### The decision that cannot be deferred forever

For each of the 89, one side is right and the other is wrong. Somebody has to say
which. Until then, `schema.ts` cannot be trusted as documentation of the database,
and the database cannot be trusted to match the app's expectations.
