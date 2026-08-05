# Script Factory v2.2 – v2.4: Production Deployment Plan

**Branch:** `feature/script-factory-v22` @ `f330451`
**Target:** production database `iUgsiz76NwfDUVHZHV7CyJ` on TiDB Serverless
**Status:** proposal for review. Nothing has been merged; production has not been written to.
**Prepared:** 2026-08-05

> Everything in this document was verified against the live production database by
> read-only introspection, or against the branch by direct file reading. Where a
> figure is an estimate rather than a measurement, it says so.

---

## 0. The three things a reviewer should know first

**Production has never received any part of v2.2, v2.3 or v2.4.** `script_factory_outputs`
is still at its original 15-column shape. Migrations `0124` through `0127` exist in the
repo and have never been applied. This is not a small delta on top of v2.3 — it is the
entire Script Factory schema history arriving at once.

**Production is TiDB Serverless, not MySQL.** Version `8.0.11-TiDB-v8.5.3-serverless`.
Every piece of sandbox verification performed during development ran against MySQL
8.0.46. TiDB's online DDL works in our favour here, but it is a different engine and the
distinction matters for both the SQL and the backup mechanism.

**The apparent size of the schema change is misleading, and taking it at face value would
damage the database.** A naive live-vs-declared diff reports 55 missing columns. Only 16
are real. 35 of the remainder are the same column under two names, and adding them would
silently split live data away from the column the application reads.

---

## Part 1 — Deployment diff audit

### 1.1 Scale

```
git diff origin/main...HEAD --stat
118 files changed, 25824 insertions(+), 899 deletions(-)

main   HEAD  cc66e2f
branch HEAD  f330451
```

### 1.2 Files changed outside the Script Factory

38 of the 118 files fall outside Script Factory modules. Most are new tests, migrations
and scripts. The following carry behavioural change to code paths a current production
user can already reach, and are the reason this deploy is not as contained as its title
suggests:

| File | Change | Why it matters |
|---|---|---|
| `server/transcriptRouter.ts` | +193 / −67 | Transcript fetching is shared with existing pipeline features, not only Script Factory research. |
| `server/corpusRouter.ts` | +159 / −91 | 91 deleted lines means behaviour was **replaced**, not extended. Corpus is used by pattern extraction generally. |
| `server/analogDataRouter.ts` | +150 / −7 | Adds offer-profile parsing to the analog data path. Largely additive. |
| `server/claimsReviewRouter.ts` | +100 / −25 | Claims review is an existing production surface with its own UI. |
| `client/src/pages/AnalyzeData.tsx` | +86 / −12 | Existing page, visible changes. |
| `server/_core/llm.ts` | model string | See Part 2. Affects **every** LLM call in the application, not just Script Factory. |
| `server/_core/index.ts` | +36 / −4 | Registers the dev-login route (guarded — see 1.5). |
| `server/patternExtractorRouter.ts` | +13 / −1 | Small. |
| `client/src/pages/ClaimsReview.tsx` | +5 / −0 | Small. |
| `server/performanceLoopRouter.ts` | +4 / −2 | Small. |
| `server/routers.ts` | +2 / −0 | Router registration only. |

`llm.ts` and `corpusRouter.ts` deserve pre-deploy review attention. The first changes the
model behind every generation in the product; the second replaced existing logic.

### 1.3 Schema changes: what actually needs DDL

Reproducible with two scripts committed alongside this plan:

```bash
node scripts/extract-schema-columns.mjs drizzle/schema.ts /tmp/cols.json
node scripts/pair-drift-vs-additions.mjs
```

**Tables to create — 3.**

| Table | Columns | Purpose |
|---|---|---|
| `research_jobs` | 16 | Deep-research job records |
| `suggested_ideas` | 20 | Persistent idea engine |
| `topic_nodes` | 14 | Topic tree for idea expansion |

**Columns to add — 16.**

| Table | Columns | Rows affected |
|---|---|---|
| `script_factory_outputs` | 13 (see migration Section 2) | 5 |
| `analog_data_entries` | `offer_profile` | 1 |
| `collective_sourcing_candidates` | `notes`, `updated_at` | 0 |

**Columns that must NOT be added — 35.** These are declaration drift: `schema.ts` and
production use different names for the same live column. A sample:

| Table | `schema.ts` says | Production has |
|---|---|---|
| `ab_tests` | `ab_test_status` | `status` |
| `apollo_sync_runs` | `asr_status` | `status` |
| `retreat_events` | `retreat_status` | `status` |
| `youtube_pipeline_videos` | `yt_status` | `yt_pipeline_status` |
| `landing_pages` | `status` | `landingPageStatus` |
| `reddit_conversions` | `redditAttributionType` | `attributionType` |
| `llm_assets` | `asset_type` | `llm_asset_type` |
| `ab_conversions` | `ab_conversion_type` | `conversion_type` |
| `book_snippets` | `platform`, `title_card_status` | `snippetPlatform`, `titleCardStatus` |

Adding any of these leaves production holding both the real column, with its data, and a
new empty one that the application then reads and writes. **No error is raised.** This is
the single largest risk in the whole exercise and the migration deliberately does nothing
about it. Reconciling drift is separate work (Part 6).

### 1.4 Behavioural changes worth flagging to the owner

**`verification_pct` has been redefined, in the same column, with no version marker.**

Main:

```ts
const verified = scriptBody.match(/\[VERIFIED\]/g)?.length ?? 0;
const total    = allBracketedMatches.length;   // [VERIFIED] + [HOOK] + [CTA] + …
const pct      = total > 0 ? Math.round((verified / total) * 100) : 0;
```

Branch (`scriptMetrics.ts:192`):

```ts
pct: total > 0 ? Math.round((grounded / total) * 100) : 0,   // total = SECTIONS
metricVersion: "v2.2-instance",
```

Main measures *the share of bracketed markers that are `[VERIFIED]`* — a number that moves
when structure changes even if grounding does not. The branch measures *the share of
sections containing grounded material*. Both write to `verification_pct`.

`metricVersion` is computed and **not persisted**, so after deploy the column holds two
incompatible measures with no way to tell which produced a given row. Five live draft rows
carry old-definition values.

Three options, none chosen here: accept a mixed column; null the five so they read "not
measured"; or add a `metric_version` column so the distinction is recoverable. The third
is the honest fix and is one more additive column — it is listed in Part 6 rather than
included, because it is outside the agreed scope.

**Legacy rows cannot be regenerated as variants.** Variant regeneration replays the frozen
`generation_params` of its source. The five existing rows have none, so the workspace
correctly disables the Regenerate group for them and displays "Unavailable for this
script". Per-section rewrite still works on them, because that path needs no frozen
params. This is honest behaviour rather than a defect, but it will be the first thing the
owner notices, so it should not arrive as a surprise.

**Per-section grounding is not recoverable from saved scripts.** `[VERIFIED]` markers are
stripped from the body before the row is written, by design. Any per-section grounding
indicator computed from a stored body is therefore false for every section. The UI does
not show one, for this reason.

### 1.5 Dev-login bypass — confirmed inert in production

```ts
// server/_core/devLogin.ts, registered from server/_core/index.ts:97
if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DEV_LOGIN !== "true") return;
```

Production environment: **`NODE_ENV` absent, `ALLOW_DEV_LOGIN` absent.** The route is never
registered, so `/api/dev/login` is a 404 rather than an endpoint that exists and refuses.

One hardening recommendation: production is currently safe because `NODE_ENV` is *unset*
and unset fails the `=== "development"` test. Setting `NODE_ENV=production` explicitly
removes the dependence on absence.

---

## Part 2 — The LLM model decision

### 2.1 What each branch does today

| | File | Value |
|---|---|---|
| main | `server/_core/llm.ts:286` | `model: "gemini-2.5-flash"` (hardcoded) |
| branch | `server/_core/llm.ts:278` | `export const LLM_MODEL = process.env.LLM_MODEL \|\| "gpt-5.5"` |

**The env-driven change is already implemented on the branch.** No code change is required.
What remains is a decision about the default, and about which value production sets.

### 2.2 Forge exposes GPT-5.5 — verified, not assumed

Called directly against the gateway using production's own `BUILT_IN_FORGE_API_KEY`:

```
gpt-5.5                : OK   prompt=78  completion=7
gpt-5                  : OK
gpt-5-mini             : OK
gemini-2.5-flash       : OK   (still resolves, though absent from the listed catalog)
gemini-3-flash-preview : OK
```

Full catalog: `gpt-5`, `gpt-5.5`, `gpt-5-mini`, `gpt-5-nano`, `claude-haiku-4-5`,
`claude-sonnet-4-6`, `claude-opus-4-6`, `claude-opus-4-7`, `gemini-3.1-pro-preview`,
`gemini-3-flash-preview`.

**Consequences.** Production needs no OpenAI account: `LLM_MODEL=gpt-5.5` runs through the
existing Forge credential and bills as Manus credits. `OPENAI_API_KEY` is **not** among
production's 54 configured secrets, and does not need to be. The contributor-billing
concern — a developer's personal key ending up in the owner's production app — cannot
arise, because no OpenAI key is present to be substituted.

### 2.3 Cost

**The gateway does not publish pricing.** Every model's `pricing` field is absent; this was
confirmed by dumping the raw catalog record rather than inferred from a parsing failure.
The figures below are therefore an **estimate**: measured token counts against published
list prices. They are not gateway-sourced and should not be quoted as such.

Measured, per LLM call, on this gateway:

```
trivial call                          prompt =    78 tokens
call with ~10,581-token system prompt prompt = 10,617 tokens   (36-token overhead)
```

There is no meaningful fixed per-call overhead; cost scales with the actual prompt. (An
early single reading of `prompt=4306` suggested otherwise and was wrong — most likely the
built-in `web_search` tool definition attaching on that one call. Repeated measurement gave
78 every time.)

A v2.4 generation is not one call. It is research context assembly, the main generation,
a title call, and conditionally a story-integrity repair pass and a sell-density rewrite
pass. A 12-minute script runs roughly 15–25k prompt tokens and 3–6k completion tokens
across those calls, based on the corpus-grounded prompts observed during development.

| Model | List price in/out per 1M | Estimated per script |
|---|---|---|
| `gemini-2.5-flash` (current) | low-cost tier | cents |
| `gpt-5-mini` | 0.25 / 2.00 | ~$0.02 |
| `gpt-5` | 1.25 / 10.00 | ~$0.08 |
| `gpt-5.5` | 5.00 / 30.00 | ~$0.28 |

Treat the right-hand column as order-of-magnitude. The honest summary: **`gpt-5.5` costs
roughly an order of magnitude more per script than `gpt-5-mini`, and the absolute numbers
are small — cents to tens of cents per script.** At a few scripts per week this is
immaterial; at hundreds per day it is not.

### 2.4 Recommendation

**Set `LLM_MODEL=gpt-5.5` explicitly in the production environment, and change the code
default to `gemini-2.5-flash`.**

Two separate points. Setting the env var deliberately gives production the better model —
`gpt-5.5` is the reason v2.4's value-first CTA and story-integrity work behaves as observed
in testing, and the difference in scriptwriting quality is the point of the branch.

Changing the *default* to `gemini-2.5-flash` means a merge performed without any env change
is behaviourally a no-op. As it stands, merging silently switches the model for the whole
product, including features unrelated to Script Factory. A default should preserve current
behaviour; the upgrade should be a deliberate act. One line:

```ts
// server/_core/llm.ts:278
- export const LLM_MODEL = process.env.LLM_MODEL || "gpt-5.5";
+ export const LLM_MODEL = process.env.LLM_MODEL || "gemini-2.5-flash";
```

This change is **not** on the branch. It is proposed for review, not applied, because it
reverses a decision made during development and that is the owner's call.

### 2.5 A token-parameter detail that will not bite, but should be known

```ts
const usesCompletionTokensParam = (model: string) => /^(gpt-5|o1|o3|o4)/.test(model);
```

GPT-5 family receives `max_completion_tokens`; everything else receives `max_tokens`. Both
are correct for their families — Gemini requires `max_tokens` and returns `content: null`
with `finish_reason: "length"` if given `max_completion_tokens`. So either model choice
works. A future third family would need this regex extended.

---

## Part 3 — Migration SQL

Two files accompany this plan:

- `docs/deploy/v24-production-migration.sql`
- `docs/deploy/v24-production-rollback.sql`

Both are hand-written. Neither was generated by drizzle.

**Never run `drizzle-kit migrate` or `drizzle-kit push` against production.** The repo's
migration history cannot be replayed: migration `0114` alters a column `vj_status` that no
migration ever creates (`schema.ts` calls it `status`), and seven files referenced by
`drizzle/meta/_journal.json` are absent. A clean replay dies partway. The sandbox schema
during development was built with `push` from `schema.ts`, which is acceptable for a
throwaway database and unacceptable here.

The migration file is structured as: pre-flight checks that abort if production is not in
the expected state, three `CREATE TABLE` statements, three `ALTER TABLE` blocks, and eight
verification queries with stated expected results. Every statement is additive. There is no
`DROP`, `RENAME` or `MODIFY`, and the only data mutation is a self-cleaning utf8mb4 probe
that can be skipped.

**Charset.** Production is already `utf8mb4` / `utf8mb4_bin` at server, database and column
level. The emoji-truncation risk was a sandbox-only condition caused by local MySQL
defaulting to `utf8mb3`. New text columns carry explicit `CHARACTER SET utf8mb4` regardless.

**One correction made while writing the SQL.** The tested `CREATE TABLE` bodies in `0124`
declare four columns as `JSON`, while current `schema.ts` declares them via `longtextJson()`
→ `longtext`. That change was deliberate (`longtextJson.ts` calls itself "FINDING #10
STRUCTURAL FIX"). Creating `JSON` columns that the code treats as `longtext` would
typecheck and then misbehave at the database boundary, so the SQL uses `LONGTEXT` and
annotates every substitution. `0124` and `schema.ts` also disagree on an enum's members and
on four columns that exist only in the code — all resolved in favour of `schema.ts`.

---

## Part 4 — Backup and rollback

### 4.1 Take the backup first

The database is small: **6.1 MB total, ~21,800 rows across 146 tables.** Largest tables are
`lead_prospects` (6,078 rows, 2.8 MB) and `research_competitor_mentions` (5,027 rows,
2.0 MB). A logical dump is quick.

**Preferred: TiDB Cloud's own backup.** This is TiDB Serverless, which provides
provider-side snapshots and point-in-time recovery from the TiDB Cloud console. A
console-initiated snapshot immediately before the migration is faster than a wire dump,
is consistent by construction, and restores through a supported path. **This is the
recommended mechanism and should be confirmed present before deploying.** I do not have
console access and cannot verify the retention window or confirm a snapshot exists — that
confirmation is explicitly a precondition of this plan.

**Secondary: a logical dump, as a portable artefact you hold yourself.**

```bash
# Credentials: python3 scripts/get-prod-db.py   (already in the repo)
mysqldump \
  --host=gateway02.us-east-1.prod.aws.tidbcloud.com \
  --port=4000 \
  --user='<PROD_USER>' \
  --password='<PROD_PASSWORD>' \
  --ssl-mode=VERIFY_IDENTITY \
  --ssl-ca=/etc/ssl/certs/ca-certificates.crt \
  --single-transaction \
  --set-gtid-purged=OFF \
  --column-statistics=0 \
  --default-character-set=utf8mb4 \
  --hex-blob \
  'iUgsiz76NwfDUVHZHV7CyJ' \
  > "prod-backup-$(date +%Y%m%d-%H%M%S).sql"
```

Notes on the flags, since several are TiDB-specific:

- `--single-transaction` gives a consistent snapshot without locking. Do not use
  `--lock-tables`; TiDB handles it differently and locking a live database is unnecessary.
- `--set-gtid-purged=OFF` — TiDB does not use MySQL GTIDs.
- `--column-statistics=0` — the MySQL 8 client queries a table TiDB does not expose.
- `--default-character-set=utf8mb4` — non-negotiable, or 4-byte characters are mangled in
  the dump itself.
- `--hex-blob` matters here specifically: `corpus_entries.embedding` is a TiDB-native
  `vector(1536)` column, and hex-encoding avoids escaping problems.

**Verify the dump before trusting it.** A dump that was never checked is not a backup:

```bash
ls -lh prod-backup-*.sql                                     # non-trivial size
grep -c 'CREATE TABLE' prod-backup-*.sql                     # expect ~146
grep -c 'INSERT INTO `script_factory_outputs`' prod-backup-*.sql   # expect >= 1
tail -3 prod-backup-*.sql                                    # expect "Dump completed"
```

**Restoring this dump elsewhere needs a translation step**, already in the repo:
`scripts/tidb-dump-to-mariadb.py` degrades `vector(1536)` to `LONGTEXT`, strips
`VECTOR INDEX`, and removes TiDB-only table options that MySQL/MariaDB rejects. Relevant if
the backup is ever restored to a non-TiDB target — vector search will not work there, but
nothing else is affected.

### 4.2 Rollback: prefer rolling back the code

The most important line in the rollback file: **you probably should not run it.**

Every added column is nullable and every added table is new, so the previous application
build ignores all of them — it does not select them, does not write them, does not know
they exist. Redeploying the previous build restores previous behaviour with the schema left
in place, at **zero data risk**. The schema additions are inert to old code.

The rollback SQL exists for the narrow case where the additions themselves are the problem.
It opens with a decision gate that counts what would be destroyed:

- rows in the three new tables,
- scripts with non-NULL `generation_params` (i.e. created post-deploy),
- variant relationships,
- bound offer profiles.

If any is non-zero, dropping the columns destroys that data irreversibly. Re-adding a
dropped column brings it back empty. Script bodies survive — the rollback loses metadata,
never the scripts — and there is an explicit verification query for exactly that.

**Order matters: roll back the code first, confirm health, then consider the schema.** New
code against a rolled-back schema fails on every Script Factory query.

---

## Part 5 — Deployment runbook

Preconditions, all of which must hold before step 1:

- [ ] This plan reviewed and approved by the repo owner.
- [ ] A TiDB Cloud snapshot confirmed to exist, or a verified `mysqldump` artefact in hand.
- [ ] Decision recorded on `LLM_MODEL` (Part 2.4).
- [ ] Decision recorded on `scripts.production_status` (Part 6, Q1) — this one blocks,
      because it determines whether the migration is 16 columns or 17.

| # | Step | Verify before continuing |
|---|---|---|
| 1 | Take the backup. | Size, `CREATE TABLE` count, `INSERT` present, "Dump completed". |
| 2 | Run migration Section 0 (pre-flight) alone. | All four EXPECT values match. If 0.2 returns rows or 0.3 returns non-zero, **stop**. |
| 3 | Run Section 1 (create tables). | Verification 5.1 and 5.2: three tables, column counts 16/20/14. |
| 4 | Run Section 2 (13 columns + indexes). | Verification 5.3, 5.4. `empty_bodies` **must** be 0. |
| 5 | Run Section 3 (`offer_profile`). | Verification 5.5. Row count unchanged. |
| 6 | Run Section 4 (`collective_sourcing_candidates`) — or skip it. | Optional; nothing in v2.2–v2.4 reads this table. |
| 7 | Run remaining verification queries 5.6–5.8. | 11 indexes; table count 149. |
| 8 | Set `LLM_MODEL` in the production environment. | Value matches the Part 2.4 decision. |
| 9 | Set `NODE_ENV=production` explicitly. | Hardening; see 1.5. |
| 10 | Merge the PR and deploy the application. | Deploy completes; app boots. |
| 11 | Smoke test: open Script Factory Library. | Five legacy scripts still listed and openable. |
| 12 | Smoke test: open one legacy script. | Body renders. Regenerate group correctly shows "Unavailable for this script". |
| 13 | Smoke test: generate one new script. | Completes; row has non-NULL `generation_params`; sell-density report appears. |
| 14 | Smoke test: create one variant from it. | Library collapses to one row reading "1 variant"; nested row opens the variant. |
| 15 | Smoke test: regenerate one section, then undo. | Body changes, then restores verbatim; grounding figure unchanged. |

Steps 11–15 are the ones that would catch a bad deploy. Steps 12 and 15 specifically
exercise the two behaviours most likely to look like bugs to a first-time user.

### What has NOT been verified, and must be stated plainly

The following are honest gaps in the evidence behind this plan:

1. **No part of v2.2–v2.4 has ever run against TiDB.** All development verification was on
   MySQL 8.0.46 in a sandbox. The SQL in this plan is written for TiDB and every statement
   uses only widely-supported DDL, but it has not been executed against a TiDB instance.
   The pre-flight and verification queries are the mitigation.
2. **The migration SQL has not been executed anywhere.** It was written from a live schema
   diff. It has not been rehearsed against a copy of production. If the owner wants
   certainty rather than care, the right move is to restore the backup into a scratch TiDB
   Serverless cluster and run the migration there first. That is the single highest-value
   addition to this plan and it is not included, because it needs console access.
3. **VidIQ was absent from every sandbox.** Research ran degraded throughout development —
   both the primary and fallback VidIQ calls failed and were logged, and generation
   continued on corpus grounding alone. v2.2's research pipeline has therefore **never been
   exercised end-to-end with its primary data source present.** `research_jobs` is created
   by this migration but the code path that populates it is the least-tested in the branch.
4. **The cost figures in Part 2.3 are estimates.** Token counts are measured; prices are
   published list prices, not gateway-reported.
5. **Multi-tier offer binding is untested.** The seeded sales page contains one tier, so
   tier selection logic has only ever run with an unambiguous choice.
6. **35 drift pairs remain unreconciled.** This deploy does not make them worse, and does
   not make them better. They are pre-existing.

---

## Part 6 — Open questions for the owner

**Q1 — `scripts.production_status` (blocking).** `schema.ts` declares
`scripts.production_status`; production has `scripts.scriptStatus`. Two readings with
opposite correct actions:

- *Rename.* Same lifecycle field under a new name → add nothing; treat as drift.
- *New field.* A genuinely new v2.2 send-to-production state, with `scriptStatus` remaining
  the draft/approved lifecycle → the column must be added, or writes to it silently vanish.

I could not determine which from the code alone and deliberately did not guess. Guessing
"rename" when it is new loses data; guessing "new" when it is a rename creates exactly the
divergence this plan otherwise avoids. **This blocks the migration**, because it decides
whether the change is 16 columns or 17.

**Q2 — `verification_pct` on the five legacy rows.** Accept a column holding two
incompatible measures; null the five so they read "not measured"; or add a `metric_version`
column so the distinction is recoverable. Recommendation: add the column — it is one more
additive change and it makes the ambiguity self-documenting rather than folklore.

**Q3 — should the sell-density report be persisted?** v2.4 computes it at generation time
and returns it in the response, but there is no `sell_density` column, so it is
session-scoped and absent when a script is reopened. Recomputing from the saved body would
recover the mention counts but not `midRollPercent` or `rewritePassUsed`, so the rail would
present a partial check as a complete one — which is why it currently reports the absence
instead. A durable fix is one additive column.

**Q4 — Section 4 of the migration: in or out?** `collective_sourcing_candidates` has
structurally diverged from its declaration, not merely drifted in naming. Nothing in
v2.2–v2.4 reads or writes it. Including its two columns is harmless (the table has 0 rows);
skipping it keeps this deploy strictly within Script Factory. Recommendation: skip, and
handle that table with the drift workstream.

**Q5 — rehearse the migration against a restored copy?** See Part 5, gap 2. This is the
highest-value addition available and needs TiDB Cloud console access.

**Q6 — schedule the drift reconciliation.** 35 pairs, in a codebase where `schema.ts` and
production disagree about the names of live columns. Every one is a latent trap for exactly
the kind of well-intentioned "let me just sync the schema" action that this plan spent most
of its effort avoiding. It deserves its own piece of work, with its own review.

---

## Appendix — Reproducing the analysis

```bash
# Production credentials (read-only introspection only)
python3 scripts/get-prod-db.py

# Column map from the code, with the two parser failure modes documented
node scripts/extract-schema-columns.mjs drizzle/schema.ts /tmp/cols.json

# True additions vs name drift — the 16-vs-55 split
node scripts/pair-drift-vs-additions.mjs

# Exact SQL types for the three new tables, from schema.ts rather than 0124
node scripts/extract-table-ddl.mjs research_jobs suggested_ideas topic_nodes
```

Both analysis scripts carry header comments documenting the specific ways an earlier,
simpler version of each produced wrong answers — enum members parsed as column names, and
drifted columns reported as missing. Those notes are there because the wrong answers looked
entirely plausible, and the next person to run this should know where the traps are.
