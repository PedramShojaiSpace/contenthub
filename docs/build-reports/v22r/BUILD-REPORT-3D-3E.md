# Script Factory v2.2 — Parts 3D and 3E Build Report

**Author:** Manus AI
**Date:** August 1, 2026
**Branch:** `feature/script-factory-v22`
**Commit:** `dffee6b`
**Baseline for this report:** `820b815` (Part 3C)

---

## 1. Summary

Parts 3D and 3E are implemented, committed, and pushed. Part 3D removes the operator-facing pattern dials and replaces them with automatic, quota-aware pattern composition. Part 3E replaces the grounding metric that overstated nothing but understated everything, makes runtime timestamps deterministic, adds an advisory cadence lint, and routes generated YouTube scripts into the compliance queue that already exists rather than a new parallel one.

One constraint dominates the verification section of this report and should be read before anything else. **The sandbox environment was reset during this work and the application configuration file — database credentials and third-party API keys — was destroyed.** That file was never committed to git, which is correct, so it did not come back with the repository. Consequently every claim in this report is backed by fixture-based unit tests, type checking, and direct code inspection. **No claim in this report is backed by a live pipeline run, a live database query, or a running sandbox URL.** The operator elected to continue building rather than wait for credentials, and Section 6 states precisely which items remain unproven as a result.

The commit is 2,278 insertions across 11 files, with three new server modules and three new test files.

| Metric | Baseline (`820b815`) | After 3D+3E (`dffee6b`) |
|---|---|---|
| Tests passing | 1,191 | **1,265** |
| Tests failing | 36 across 15 files | **36 across 15 files** |
| Failing-file set | 15 missing-API-key files | **identical, byte for byte** |
| `tsc --noEmit` errors | 22 | **22** |
| v2.2 test files | 9 (173 tests) | **12 (239 tests)** |

Every one of the 36 failures is a test that asserts the presence of a third-party API key and throws when it is absent. That set was failing before this work started and is unchanged by it. No v2.2 file fails.

---

## 2. Part 3D — Automatic Pattern Composition

### 2.1 The problem the dials created

The generation panel asked the operator to select which of eleven pattern types to draw from, then to set a minimum effectiveness threshold and a per-type cap. This is a request for information the operator does not have. Whether the corpus currently holds three usable proof elements or none is a property of the database at that instant, not a preference. The dials also produced a genuine dead end: unchecking every type disabled the Generate button with no explanation of why.

Worse, the sort those dials fed was sorting on a constant. The measurement is in the Part 2b artifact: the mapping `min(0.9, max(0.5, breakoutScore/10))` was applied to fifteen real pattern rows whose raw scores spanned 2.0 to 330.3, and it produced **0.90 thirteen times, 0.82 once, and 0.50 once**. Any raw score at or above 9 pinned to the ceiling. `ORDER BY effectiveness_score` was therefore ordering by insertion order in practice, and any 3D logic that ranked "by effectiveness" would have been ranking noise.

### 2.2 What shipped

`server/patternComposition.ts` (326 lines, 30 tests) composes the pattern set automatically in two stages.

Research-tagged patterns are placed first, weighted by the discovery rank of the video they were mined from, so that a pattern extracted from the top-ranked on-topic video outranks one from the tenth. Remaining slots are then filled from the global corpus under per-type quotas.

> The sweep is written as an explicit per-type walk in priority order, deliberately **not** as a flat effectiveness-sorted list. A flat sort is exactly what allows a corpus containing many mediocre hooks to consume the slots reserved for proof elements and objection handlers — the failure mode the specification names.

| Constant | Value | Rationale |
|---|---|---|
| `MAX_COMPOSED` | 15 | Beyond roughly fifteen patterns the model begins averaging them together rather than drawing on any of them. |
| `MIN_GLOBAL_EFFECTIVENESS` | 0.4 | Floor for the global sweep. Research-tagged patterns bypass it, having earned their place by relevance. |
| `CANDIDATE_FETCH_LIMIT` | 400 | One wide fetch replaces the previous eleven-query per-type loop. |

Quotas are `proof_element` 3; `hook`, `pain_point`, `transformation_arc`, `objection_handler` 2 each; and `cta`, `open_loop`, `authority_signal`, `social_proof`, `story_structure`, `key_phrase` 1 each.

### 2.3 Effectiveness scoring, replaced

`outlierEffectiveness()` applies `log1p` compression normalised against `log1p(100)` and maps the result into the range **0.45 to 0.88**. The function is strictly monotonic, so ranking is meaningful across the whole input domain, and its ceiling stays below the 0.8-and-above band where operator-curated analog data is inserted. Competitor-derived material should not outrank material the operator chose deliberately.

This was the one open design decision flagged to the operator, who deferred to judgement. Percentile ranking was considered and rejected because it makes a pattern's score depend on which other rows happen to exist at that moment, which would make scores incomparable across runs.

### 2.4 Usage integrity

Version 2.1 incremented `usage_count` for every pattern **fetched**, not every pattern used. This matters beyond tidiness: `usage_count` is an input to the effectiveness signal that `performanceLoopRouter` weights by, and composition's own tie-break prefers less-used rows in order to rotate the corpus. A pattern that was never shown to a model accumulated usage identical to one that shaped every script, and unlike a display bug this is unrecoverable after the fact — the true counts are gone.

`usedPatternIds` is now `composition.composedIds`: exactly the patterns that entered the prompt. Fetch is not use. A dedicated test asserts the composed set is the only increment source.

### 2.5 Ordering and persistence

Composition runs strictly **after** research resolution. Placed before it, the research weighting would be dead code — there would be no ranked video list to weight against. This required threading `rankedVideoIds` through `ResolvedResearch` and `EMPTY_RESEARCH`.

The composition record is persisted to a new `pattern_composition` column, declared **LONGTEXT rather than `json()`**, consistent with finding #10: all fifteen pre-existing `json()` declarations in this schema are physically LONGTEXT. Persisting rather than only returning it means the grounding disclosure survives reopening a script from the Library. An additive migration ships at `docs/build-reports/v22r/migrate_3d_pattern_composition.mjs`.

### 2.6 Interface changes

The eleven-checkbox grid and both sliders are **deleted, not hidden**, along with the now-unused `Slider` import and `PATTERN_TYPES` constant. The Generate button no longer carries the `selectedTypes.length === 0` disable condition. The idea engine's per-idea pattern recommendation survives as an invisible pass-through hint, so that signal is not lost with the controls.

In their place the result card renders a grounding disclosure: research versus global counts, per-type chips, and an amber line naming `unfilledTypes` — the beats that reached the prompt with no grounding at all. Padding those slots with off-type patterns to improve the appearance of the number is precisely the dishonest reporting this build exists to remove. `unfilledTypes` is suppressed when the total cap was the limiting factor, since a cap doing its job is not thin coverage.

---

## 3. Part 3E — Honest Metrics, Timestamps, Cadence, Claims

### 3.1 The grounding metric

`countVerifiedTags()` divided the count of `[VERIFIED]` tags by the count of **all** bracketed tokens in the script. Structure labels — `[HOOK]`, `[PAIN]`, `[TEACH]`, `[CTA]` — sat in that denominator. Labelling a script more thoroughly therefore *lowered* its reported grounding while changing nothing about how grounded the script actually was, and a fully grounded four-section script scored 50 percent.

`computeGroundingMetric()` in `server/scriptMetrics.ts` counts **section instances**: the numerator is instances containing at least one `[VERIFIED]` element, the denominator is all section instances excluding slot-only sections. Instances rather than distinct types, so one grounded `[TEACH]` cannot stand in for five ungrounded ones. A `[VERIFIED]` tag appearing inside story-slot instructional text does not count, because that text is an instruction to the operator, not script content. The result carries a `byTag` breakdown and `metricVersion: "v2.2-instance"`.

`countVerifiedTags` is retained and still exported, carrying a long deprecation note that documents what legacy numbers meant. A test pins the exact divergence — the four-section fully grounded case scores 100 percent new against 50 percent legacy — so the difference stays documented rather than becoming folklore.

The `update` procedure uses the **same** metric. Two definitions racing on the same three columns, selected by whether a script happened to be edited, would be worse than the original inflated number: an operator fixing a typo would have watched the verified percentage jump for no visible reason.

Pre-v2.2 rows are marked `(legacy)` in the interface with a tooltip explaining that their number is not comparable. The marker uses a creation-date heuristic against the branch date, and the tooltip says so; the rows carry no metric-version column, and backfilling one would mean asserting history that cannot be verified.

### 3.2 Deterministic timestamps

`insertTimestamps()` strips before it inserts, making it idempotent. The previous failure mode accumulated `(0:00) (0:00)` when a conditional rewrite pass ran, because stamping was not ordering-safe. Stamps are computed at **145 words per minute**, with story slots credited at `STORY_SLOT_WORD_CREDIT` (200 words) since a slot represents content the operator will speak. Stamping is applied last, after every rewrite pass — story correction and continuation both change word counts, so a stamp computed before them is simply wrong.

One honest note on interpretation, asserted by test: the final stamp marks the **start** of the last section, so a fifteen-minute script's last stamp lands around 13:55. The runtime figure is the ~15:00 total, not the last stamp.

### 3.3 Cadence lint

Nine rules target the openers and filler phrases that make a script sound machine-written. They use **bounded-gap** matching rather than literal string matching, because models paraphrase clichés — a literal matcher catches the exact form they rarely emit and misses what they actually write. The gaps are bounded rather than greedy specifically to avoid false positives, since a lint that cries wolf gets ignored and then provides nothing.

Two advisory ratios accompany the rules: `uniformSentenceRatio` and `contractionFreeRatio`.

The lint **degrades and never blocks** — deliberately the opposite of the Part 3A story-integrity lint, which throws. A fabricated patient case is a compliance exposure; a clichéd opener is taste. Violations ride along on the response so the operator can fix them in seconds. Withholding a finished, usable script over phrasing would be the wrong trade.

The prompt now also requests at least one `[VERIFIED]` element per **section** (replacing the old "aim for 40% coverage", which was measured against the broken denominator) and forbids the model from emitting `(m:ss)` timestamps of its own.

### 3.4 Claims routing

The Part 2b probe established that submitting `contentType: "youtube_script"` returned **HTTP 400**, and that the only thing rejecting it was a zod enum. `claims_reviews.content_type` is `varchar(64)` in the live schema, so **no DDL is involved**.

`createClaimsReview()` was extracted from `reviewContent` so the Script Factory and the Claims Review page share one creation path, one rubric, and one verdict shape. A parallel claims engine for scripts would have meant two rubrics and a review queue that silently omitted scripts.

The call is made **post-commit, inside a try/catch**, after the script row is saved and its id is known. This ordering is not stylistic. An LLM call inside the generation path is what destroyed finished scripts in the earlier build: the rubric threw, the error escaped the mutation, and the operator lost a script that had already been written and committed. A compliance check failing is not a reason to discard compliant work. The response reports `claimsQueued` truthfully in both outcomes, and a test asserts the review is attempted exactly once per generation so a retry loop cannot multiply LLM spend.

Routing applies to the `youtube_script` format only, per specification; the shorter formats pass through their own publish-path review. It is never a gate — the operator is the qualified reviewer, and the badge on script detail (sourced by `contentType` plus `contentId`, linking to the existing queue) only tells him where to look.

---

## 4. Verification

All figures below were produced on `dffee6b` in the sandbox and are reproducible with the commands shown.

### 4.1 Test suite

`npx vitest run` — **1,265 passing, 36 failing, 1,301 tests across 89 files.**

The 36 failures span 15 files, every one of them asserting a third-party credential: `claudeLLM`, `dataForSeo`, `gmail.credentials`, `googleDrive`, `heygen`, `ingest`, `kajabi`, `klaviyo`, `landingPages`, `metaAds`, `pexels`, `substack.session`, `typeform`, `wordpress.publish`, `youtube`. The failing-file set is identical to the pre-work baseline. Zero v2.2 files fail.

### 4.2 v2.2 test inventory

| Test file | Tests | Part |
|---|---|---|
| `server/vidiq.v22.test.ts` | 18 | 1 |
| `server/storyIntegrity.test.ts` | 38 | 3A |
| `server/scriptFactory.storyIntegrity.test.ts` | 8 | 3A |
| `server/offerProfile.test.ts` | 31 | 3B |
| `server/offerLadder.test.ts` | 18 | 3B |
| `server/researchGrounding.test.ts` | 25 | 3C |
| `server/scriptFactory.researchFirst.test.ts` | 12 | 3C |
| `server/longtextJson.test.ts` | 15 | finding #10 |
| `server/patternComposition.test.ts` | **30** | **3D** |
| `server/scriptMetrics.test.ts` | **39** | **3E** |
| `server/claimsRouting.test.ts` | **5** | **3E** |
| **Total** | **239** | |

### 4.3 Type checking

`npx tsc --noEmit` — **22 errors**, identical to the branch-point baseline, confined to the same five pre-existing files (`client/src/pages/YouTubeAnalytics.ts`, `server/ga4Router.ts`, `server/patternExtractorRouter.ts`, `server/transcriptRouter.ts`, `server/ytAnalyticsRouter.ts`). None in v2.2 scope.

Two errors were briefly introduced and fixed during this work: `matchAll` over a regex iterator is not permitted at this project's TypeScript target, so section-tag collection uses an explicit `exec` loop with `lastIndex` reset. Baseline was restored before commit.

### 4.4 Isolation

`main` remains untouched at `cc3d7ab`. Remote state after push:

```
dffee6b439f629d3dcaf6718bc51eec5938225ce  refs/heads/feature/script-factory-v22
cc3d7ab0ea43e1a4dfbb699b9e0d227477b0efe5  refs/heads/main
```

---

## 5. Recovery Notes

The sandbox was reset twice during this build, the second time destroying `/home/ubuntu/contenthub/.git`. Two lessons are worth recording because both nearly caused silent data loss.

**The snapshot restore was not uniformly newer than the remote.** `drizzle/schema.ts` and `server/vidiq.ts` came back from an earlier point and would have silently reverted the finding-#10 LONGTEXT conversion and the fix-9 wire mapping. Every file was diffed against the fresh clone before copying and those two were skipped. After a reset, restored files must never be bulk-copied over a clone without a per-file diff.

**Removing an `as any` exposed real drift.** During recovery, `structure_summary`'s declared drizzle type turned out to describe a shape the code never writes. This is the same failure class as finding #10: a cast is a promise to the compiler, not a conversion. Corrected in the 3C commit.

---

## 6. Deferred — What This Report Does Not Prove

This section exists because the build's own trust protocol holds that a single unreproducible claim voids an entire report. The following items are **implemented and unit-tested but not verified against live data**, and will remain so until the application configuration file is restored.

| Deferred item | Why it cannot be proven now |
|---|---|
| Three migrations: `migrate_3b_offer_profile.mjs`, `migrate_3c_structure_summary.mjs`, `migrate_3d_pattern_composition.mjs` | No database credentials; the scratch database `contenthub_v22_sandbox` is unreachable. |
| Live end-to-end generation with automatic composition | Requires both the database and vidIQ/Supadata/LLM keys. |
| A real `claims_reviews` row written with `content_type = 'youtube_script'` | Requires the database and the rubric LLM. The zero-DDL premise was proven in Part 0 by direct column inspection; the insert path is not yet exercised end to end. |
| The grounding metric measured on a genuinely generated script | Fixtures are hand-authored. The Part 1 lesson applies: authored fixtures are consistently kinder than live payloads. |
| Sandbox URL for operator review | The application cannot boot without configuration. |
| Purge of the 15 off-topic `research_job_2` patterns | Requires database access. Until purged, gaming-video and TV-drama derived lines remain in `content_patterns` and would be candidates for composition on a live run. |

Two carried-forward items from earlier parts also remain open and are not addressed by 3D or 3E. The relevance hard gate has never been observed firing on a nonsense seed after a confirmed server restart — the one probe that appeared to test it in fact ran against a server binary predating the code. And a known gap in Part 3B stands: the CTA does not state the tier price even when bound to a priced tier, because `buildOfferBlock` emits price framing without requiring the price be stated.

### Recommended sequence when credentials return

Run the three migrations against the scratch database; purge the off-topic patterns by job lineage using `purge_offtopic_patterns.mjs`; restart the sandbox application via `run-sandbox.sh` with `SANDBOX_MODE=1` and **confirm the restart before probing**; then re-run `probe_research_first_live.mjs` and add composition and metric probes. Only then should any of Section 6 move into Section 4.

---

## 7. Files Changed

```
 client/src/pages/ClaimsReview.tsx                    |   5 +
 client/src/pages/ScriptFactory.tsx                   | 263 ++++++---
 docs/.../migrate_3d_pattern_composition.mjs          |  72 +++
 drizzle/schema.ts                                    |  22 +
 server/claimsReviewRouter.ts                         | 125 +++--
 server/claimsRouting.test.ts                         |  80 +++
 server/patternComposition.test.ts                    | 336 +++++++++++
 server/patternComposition.ts                         | 326 +++++++++++
 server/scriptFactoryRouter.ts                        | 384 +++++++++++--
 server/scriptMetrics.test.ts                         | 351 ++++++++++++
 server/scriptMetrics.ts                              | 441 ++++++++++++++
 11 files changed, 2278 insertions(+), 127 deletions(-)
```
