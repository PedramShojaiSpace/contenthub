# BUILD PROMPT — Script Factory v2.2 FULL BUILD (Self-Contained)
## Supersedes every prior v2.2 prompt and report. This document is the complete specification.

**Context you must acknowledge:** The v2.2 build was previously reported complete; verification proved no v2.2 code exists. The repo sits at v2.1 (`525780b`). Your session context was compacted and the original spec was lost. This document replaces it entirely — do NOT reconstruct anything from memory, and treat every prior v2.2 report, including your own, as void. The verified diagnostic findings incorporated below are the only carry-over.

---

## STEP ONE — PRESERVE THIS SPEC (before any other action)

1. Create branch `feature/script-factory-v22` from `525780b` (or check it out if it exists; confirm its HEAD with raw output).
2. Commit this document, verbatim, as `docs/build-reports/v22r/SPEC.md`. Push immediately.
3. **At the start of every Part below, re-read `docs/build-reports/v22r/SPEC.md` from disk.** If your context is ever compacted mid-build, the spec on disk is the source of truth — never your recollection of it.

## TRUST PROTOCOL (violation invalidates the entire report)

1. **Claims require artifacts, inline.** Every asserted test result, DB count, HTTP response, or working fix is accompanied by its raw command output in the same checkpoint. A number without raw output does not exist.
2. **Push after every Part.** The operator verifies on GitHub, not from your prose. After Part 0, open a **draft PR** against `main` titled "Script Factory v2.2" — never merge it.
3. **Live sandbox URL** delivered at Part 2 and kept working through the end. The operator's own click-through is the acceptance test.
4. **Verification artifacts are committed files** under `docs/build-reports/v22r/`. A filename mentioned in a report must exist in the pushed branch.
5. **Corrections are welcome; inventions are terminal.** "X incomplete because Y," with evidence, is a good checkpoint. One unreproducible claim rejects the whole report.

## ENVIRONMENT & ISOLATION

- All work on `feature/script-factory-v22`. Nothing merges to `main`; the live site is untouched.
- **Scratch database:** clone the staging DB (`mysqldump` staging → create `contenthub_v22_sandbox` → restore). The sandbox app and ALL migrations point at the scratch DB only. Staging is read-only for ground-truth probes; production is never touched. Document the connection wiring in the report.
- The sandbox app runs in this environment and is exposed at a public URL. Cold starts are acceptable; broken is not.

## SCOPE WALL

You may modify: `server/scriptFactoryRouter.ts` (+ its test), `server/vidiq.ts`, `server/transcriptRouter.ts` (only to export a shared quota-aware fetch helper), `server/claimsReviewRouter.ts` (extend only — read first), `drizzle/schema.ts` (append-only, plus the seven name-only corrections in Part 1), new migration files, `client/src/pages/ScriptFactory.tsx`, `server/routers.ts` (wiring), and one cron registration in `server/index.ts`. Nothing else. The additional drifted tables listed in Part 1 are explicitly out of scope.

---

## PART 0 — GROUND TRUTH

Run, paste raw, and commit to `docs/build-reports/v22r/00-ground-truth.txt`:

1. `git branch -a` · `git log --oneline -10` · `git reflog | head -20` · `git ls-remote origin` · `git status`.
2. Staging DB counts in one query: `content_patterns`, `yt_transcripts`, `yt_video_outliers`, `research_jobs` (each row's status + error), `claims_reviews`, `script_factory_outputs`, `analog_data_entries`, `suggested_ideas`.
3. Column-absence probes: `analog_data_entries.offer_profile`, `script_factory_outputs.pattern_composition`, `research_jobs.structure_summary` — expected ABSENT.
4. Clone staging → `contenthub_v22_sandbox`; show row counts match.
5. Push; open the draft PR.

---

## PART 1 — VERIFIED FIX SET (eight items; no DDL, no migrations, nothing else)

These defects were verified live against the VidIQ MCP endpoint and the staging DB. Items 1–5: `server/vidiq.ts`. Items 6–8: name-only declaration corrections in `drizzle/schema.ts`.

1. **`callVidIQTool` never checks `result.isError`.** MCP tool failures arrive as HTTP 200 with `result.isError: true` and the reason in `content[0].text`. Add the check; on error, throw typed `{ kind: "tool_error", tool, rawMessage }` carrying the verbatim text.
2. **Read `result.structuredContent`, not `JSON.parse(content[0].text)`.** For several tools `content[0].text` is markdown prose (verified: a *successful* `vidiq_keyword_research` returns "Research for **gut health fatigue** found 10 related suggestions…"), so the current parse throws on the happy path — the root cause of every "Supercharge failed." New contract: prefer `structuredContent` when present; else attempt `JSON.parse(text)`; else return `{ _text }` and let the caller decide. Re-type wrappers to the shapes they actually receive.
3. **`vidiq_outliers` sends `contentType: "video"`; live enum is `all | long | short`.** Fails validation on every call — this is why Deep Research has never once completed. Default `"long"`; expose as an optional wrapper param.
4. **`vidiq_trending_videos` sends `videoFormat: "video"`; live enum is `long | short`.** The fallback path is equally broken. Default `"long"`.
5. **`vidiqBalance` reads `.credits`, which does not exist.** Live shape: `{ type, totalCredits, renewableCredits, maxRenewableCredits, renewableResetsAt, addOnCredits, maxAddOnCredits, _credits }`. Re-type; all pre-flight checks and UI read `totalCredits`.
6–8. **Schema declaration corrections** (declaration → live column; name-only, zero DDL):

| Table | Correct declarations to |
|---|---|
| `yt_transcripts` | `status`, `created_at`, `updated_at` (were `transcript_status`, `tr_created_at`, `tr_updated_at`) |
| `claims_reviews` | `content_type`, `status` (were `cr_content_type`, `cr_status`) |
| `yt_video_outliers` | `created_at`, `updated_at` (were `outlier_created_at`, `outlier_updated_at`) |

While here: `SHOW COLUMNS` on `claims_reviews.content_type` and report its live **type** (varchar vs enum) — Part 3E depends on the answer; do not guess.

**Out of scope, list-only:** `reddit_conversions.attributionType`, `apollo_sync_runs`, `youtube_pipeline_videos`, `retreat_events`, `ab_tests`, `ab_conversions`, and the structurally-diverged `collective_sourcing_candidates`. Commit the drift-audit script and its full raw output as artifacts for a future cleanup; touch none of them.

**Part 1 verification** (raw, committed to `01-fixes-proof.txt`): `vidiqBalance()` real totals · `vidiqKeywordResearch("gut health fatigue")` structured metrics · `vidiqOutliers("leaky gut fatigue")` **top 5 results printed: title, channel, views** (the operator judges topical relevance from this real list) · trending fallback returns results · read/write probes on the three corrected tables succeed, with the old names shown failing (`ER_BAD_FIELD_ERROR`) side by side · new unit tests for isError/structuredContent/balance · vitest summary + `pnpm tsc --noEmit` raw, with the pre-existing env-dependent failure baseline shown identical at `525780b`. Push.

---

## PART 2 — SANDBOX LIVE + PIPELINE PROOF (the operator gets a link here)

1. Build and run the app in this sandbox against `contenthub_v22_sandbox`. Expose it publicly. **Post the URL.**
2. With only Part 1's fixes in place, prove the machine runs — raw outputs committed to `02-live-proof/`:
   - One Deep Research job for a real health keyword end-to-end: `research_jobs` row `complete` with outlier/transcript counts; `content_patterns` now > 0; 3 sample pattern rows printed; `yt_transcripts` rows selected and printed.
   - Supercharge on ≥3 un-enriched ideas: per-idea outcomes in the response; persisted `vidiqData` shown; survives reload.
   - One claims-review insert through the existing creation path succeeds (shown, then removed, shown).
3. Update the PR description: sandbox URL, branch compare link, one-paragraph state summary. Push.
4. **Do not wait for approval — proceed directly to Part 3.** Everything is sandbox-isolated; the operator will verify in parallel and can interject at any time. After each Part 3 section lands, redeploy the sandbox and post one line: "now clickable: …".

---

## PART 3 — THE v2.2 FEATURE BUILD

General rules for every section: implement → test → commit → push → checkpoint with raw outputs → redeploy sandbox. All schema changes are additive migrations run against the scratch DB and listed in the report. All LLM-prompt requirements below are covered by mocked-LLM tests asserting the prompt contains the required blocks.

### 3A — Story Integrity: no fabricated patients, ever

The system previously invented a named patient with quoted dialogue and specific clinical findings inside content that sells a health offer. The operator is a licensed practitioner with real cases; the system's job is to hand him a story slot, not to invent a human.

- `generate` input gains `storyMode: z.enum(["brief","composite","none"]).default("brief")`; three-option selector in the panel.
- **`brief` (default):** no invented named patients, no quoted patient dialogue, no fabricated individual clinical findings anywhere. Where structure calls for a story, emit a delimited slot:
  `[STORY SLOT — INSERT YOUR REAL CASE HERE]` + a suggested ~90-second shape generated from THIS script's own pain points and teaching mechanism (symptoms → conventional dead end → what testing revealed → intervention direction → outcome arc) + the reminder "use a real case; anonymize or say 'a composite of patients I've worked with.'" + `[END STORY SLOT]`.
- **`composite`:** narrative allowed, but: no proper names; opens with an audible label ("Let me give you a composite of patients I see all the time…"); no invented quoted dialogue; no specific fabricated lab values/timeframes stated as measured facts. **An unlabeled composite is a violation** — to a listener it is indistinguishable from a real case.
- **`none`:** story blocks omitted; word budget redistributes to teach blocks.
- System prompt gains `=== STORY INTEGRITY (NON-NEGOTIABLE) ===`: never invent a named individual, never attribute quotes to a patient, never state individual test results/diagnoses/recovery timelines unless that material exists verbatim in the provided corpus.
- **Lint by violation class, not spec phrases** (a literal `client named` matcher misses "Sarah, a brilliant executive in her late 50s"): (1) named-patient introductions including bare appositives; (2) quoted patient dialogue, both word orders; (3) individual-attributed clinical specifics ("her CRP was 8.2" flags; "CRP dropped 40% across 200 participants" must NOT); (4) invented recovery timelines. False-positive coverage is mandatory: the slot template's own text, the operator's own name, and population statistics must not flag. One automatic correction pass; if still violating, **fail the generation — never save a violating script.**
- **Word budgeting must credit story slots** at ~200 words each (instructional text excluded) so the under-length continuation pass cannot be triggered into writing the story the rules forbid. Implement as a dedicated counting function.

Acceptance: default generation on a story-less corpus yields a delimited slot whose shape references the script's own symptoms, zero named patients (lint test on a fixture reproducing the known violation); composite mode contains the audible label and no proper names; the hard-fail path is tested (mocked LLM violating twice → error, nothing saved); a 15-minute script with two slots does not trigger the continuation pass (test).

### 3B — Offer Binding: the CTA sells the North Star's actual offer

Previously a 15-minute script built the case for testing, then closed on a generic brand CTA — the system has no concept of "the offer."

> **AMENDED after live-data failure.** This section originally specified
> `offer_profile` as a **single** object. Extraction against the real corpus
> returned `null` every time, because the live sales page ladders several
> purchasable tiers and a single-object shape cannot represent it — the extractor
> had no valid way to answer. The operator's decision was to surface every tier
> and choose one at generation time. The text below describes the **shipped
> code**; the single-object shape it replaces is retained as `OfferProfile`, now
> nested inside a ladder. Recorded here so the spec and the code do not disagree
> after context loss.

- ALTER `analog_data_entries`: add `offer_profile` json nullable. Stored shape is a **ladder**: `{ tiers: OfferProfile[] }`, where each `OfferProfile` is `{ offerName, offerType: "product"|"service"|"program"|"lead_magnet"|"other", deliverables: string[], guarantee: string|null, timeline: string|null, pricePoint: string|null, primaryCtaUrl: string|null, targetAction: string }`. A page selling exactly one thing stores a single-element `tiers` array — the ladder is always the outer shape, never conditionally applied.
- `extractOfferProfile({ analogDataEntryId })`: LLM-extracts from the entry's content, saves, returns; idempotent (re-run overwrites). The extractor returns **every distinct tier a buyer could purchase**, richest first. Tiers must be genuinely purchasable options — never features, bonuses, or chapters; two names for the same purchase collapse to one tier. **Extraction failure returns an empty `tiers` array, never a partial object** (a saved profile with an empty offerName would instruct the model to "name the offer: ''" and it would invent one). Empty ladder → the offer block is omitted entirely and generation proceeds unbound. The extractor must not invent absent facts — a page that states no duration yields `timeline: null`. A guarantee stated page-wide applies only to the tiers the copy actually covers, never copied onto an excluded tier.
- Tier selection at generation time — `selectOfferTier(ladder, requestedOfferName?)` returns `{ profile, reason }`:
  - empty ladder → `{ null, "no_offer" }`
  - explicit `offerName` matches a tier → `{ tier, "explicit_tier" }`
  - explicit `offerName` matches nothing → `{ null, "requested_tier_not_found" }`
  - exactly one tier, none requested → `{ tier, "single_tier" }`
  - multiple tiers, none requested → `{ null, "tier_not_chosen" }`
  The `tier_not_chosen` refusal is deliberate: with several price points available, guessing which one the script sells would put an unintended price in a CTA. The system declines to bind rather than pick.
- Generate panel: when a selected North Star lacks a profile, an inline "Extract offer" control runs extraction and renders the parsed tiers for a visual check. When the stored ladder holds more than one tier, the panel presents tier chips and the chosen `offerName` is passed to generation as `offerTier` (optional string input). A single-tier ladder surfaces no picker.
- Generation: when a selected entry has a profile, inject `=== THE OFFER (what this script ultimately sells) ===`; the `[CTA]` must name the offer, cite ≥2 concrete deliverables, and state the guarantee **only when one exists** (instructing "state the guarantee" when there is none invites invented refund terms); teaching sections build toward `targetAction`. Optional `ctaOverride` string **replaces** the offer binding rather than coexisting with it (otherwise the script argues with itself for fifteen minutes).
- Free-value guard: max 3 practical tips; each must connect back to why `targetAction` remains the necessary next step; tips may never be framed as sufficient to resolve the core problem.

Acceptance: extraction on the live sales page in the corpus yields its real tiers, each with real offer name, deliverables, guarantee, and a sensible targetAction, with unstated fields null (fixture test + live run printed); every `selectOfferTier` branch tested, including the `tier_not_chosen` refusal and `requested_tier_not_found`; generated CTA meets the binding rules and names the **selected** tier only (mocked-prompt assertion + live inspection); ctaOverride path tested; failure→empty-ladder path tested.

### 3C — Research-First Generation: hooks and structure from winning videos

- **Deep research is the default for `format='youtube_script'`.** If no `researchJobId` is supplied and a seed exists (idea's `seedKeyword`, else the topic), auto-run research before generating, with staged progress in the panel. `skipResearch: z.boolean().default(false)` backs a "Quick generate" toggle.
- **Reuse:** a `complete` job for the same seed keyword within 14 days is reused at zero cost (response flags `researchReused: true`).
- **Fail-open:** the entire auto-research block sits in try/catch; research failure records a reason and generation proceeds. A grounding enhancement that can block content production is a worse regression than the problem it solves. Test both paths.
- **Shared function:** extract the research pipeline body into `executeDeepResearch(db, opts)` called by both the tRPC procedure and `generate` — no duplicated pipeline code. (If the v2 pipeline procedure does not yet exist in this codebase at v2.1, build it here per this spec's pipeline description: seed keyword → `vidiqOutliers` top ≤25 (fallback: trending) → for the top ≤10, transcript acquisition through the quota-aware Supadata helper exported from `transcriptRouter.ts`, cache-first against `yt_transcripts`, persisting full raw text, quota exhaustion sets `quotaBlocked=true` and continues with what was secured → pattern mining on the top 5 transcripts via the existing pattern-extraction machinery, tagged `research_job_<id>` → status `complete`; a `research_jobs` table with staged statuses, counts, `outlierVideos` json, `patternIds`, `errorMessage`; only hard-fail when zero outliers AND zero cached transcripts exist.)
- **Hook references:** store each secured transcript's opening ~200 words as a `content_patterns` row, `patternType='hook'`, tags `research_job_<id>` + `opening_segment`, effectiveness ≤0.9 (analog data stays dominant), excluded from any per-video pattern cap. Classify each opening's structure — `cold_open_story | contrarian_claim | question_stack | stat_shock | direct_callout | demonstration | curiosity_gap` — stored in the pattern's context.
- Generation injects `=== HOOK REFERENCES — OPENINGS FROM WINNING VIDEOS ON THIS TOPIC ===` (≤6: title, views, structure label, opening text) with: *choose the structure that fits; write a completely original opening in that structure; the first 15 seconds must contain a pattern interrupt or curiosity gap — a soft rhetorical question ("Have you ever felt…") is not an acceptable opening.* No research → structure labels alone, same 15-second rule.
- **Structure summary:** one aggregate LLM pass over the top 3 transcripts → `research_jobs.structure_summary` json (section flow, pacing, first-payoff point, re-hook placement, CTA placement), injected as advisory guidance subordinate to Northstar and offer rules.

Acceptance: auto-research runs when absent, reuses within 14 days, honors skipResearch (tests); research failure still yields a saved script (test); hook block present with labels (mocked-prompt assertion); live smoke opening is not a soft rhetorical question; opening segments and structure_summary persisted (live rows printed).

### 3D — Automatic Pattern Composition: remove the dials

- **UI:** delete the 11-checkbox pattern-type grid and both sliders. The generation panel's visible inputs are exactly: persona, North Star source(s) (+ Extract offer), length (10/15/20 — youtube_script only), story mode, Deep Research toggle (default on) / Quick generate, optional CTA override. Nothing else. (This also removes the old dead-button bug where unchecking everything disabled Generate with no explanation.)
- **Server:** keep `selectedTypes`/threshold/per-type params as optional API-level overrides with new defaults (non-breaking; the idea engine's per-idea pattern recommendation may pass through `selectedTypes` invisibly), but the UI never sends them.
- **Composition algorithm:** runs strictly AFTER research resolution (otherwise research weighting is dead code). Single candidate fetch, then: research-job-tagged patterns first, weighted by source-video rank; remaining slots filled globally by `effectivenessScore` (min 0.4) under per-type quotas; total cap ~15. The fallback sweep must be **quota-aware**: a corpus rich in weak hooks must not overfill the hook quota just because hooks are plentiful.
- **Usage integrity:** `usage_count` increments only for patterns actually composed into the prompt — never for the fetched candidate pool (inflating usage on unused rows corrupts the effectiveness signal all future compositions depend on).
- Persist `pattern_composition` json on `script_factory_outputs`, including `unfilledTypes` — the types the corpus was too thin to fill — and render a "Grounding" disclosure in the script detail (N research patterns, M global, unfilled types named). Thin coverage is reported, never silently padded.

Acceptance: panel snapshot shows exactly the six inputs; research-attached composition provably prefers job-tagged patterns (seeded test); quota-aware sweep tested (weak-hook-rich fixture must not exceed the hook quota); usage_count incremented only for the composed set (test); `pattern_composition` + `unfilledTypes` persisted and rendered.

### 3E — Honest Metrics, Deterministic Timestamps, Cadence Lint, Claims Routing

- **Grounding metric:** current code divides `[VERIFIED]` tags by ALL bracketed tags — structure labels inflate the denominator; the number is meaningless. Recompute over **section instances** (a 15-minute script has ~14 sections because `[TEACH]` recurs; distinct-type counting would hide five ungrounded TEACH blocks behind one grounded one): numerator = section instances containing ≥1 `[VERIFIED]`; denominator = all section instances, **excluding slot-only sections** (compliant story behavior is not penalized; `[VERIFIED]` inside slot instructional text does not count). UI copy: "X of Y sections grounded." **The `update`/edit procedure must use the same metric** — two definitions racing on the same columns depending on whether a script was edited is worse than the original bug. Keep the old function exported with a deprecation note as documentation of what pre-v2.2 numbers meant; legacy rows display a "legacy metric" tooltip (creation-date heuristic acceptable).
- **Timestamps:** strip any LLM-emitted `(m:ss)` markers, then recompute deterministically — cumulative words at 145 wpm, inserted at each structure tag; story slots count 200 words. **Idempotent** (strip-then-insert), so ordering against story-correction/cadence-rewrite passes cannot stack `(0:00) (0:00)`. Fixture test; a 15-minute script's final stamp lands near 15:00.
- **Cadence:** system prompt gains `=== WRITE LIKE A HUMAN ON CAMERA ===` (contractions required; sentence-length variance; banned list: "Now, I know what you're thinking", "Think about that for a moment", "And what do they tell you?", "Let's dive in", "But here's the thing", "In today's video", "Without further ado", "It's important to note", "game-changer"). Post-generation lint matches high-value entries with **bounded-gap tolerance** — models paraphrase clichés ("Now, I know what *some of you might be* thinking" must be caught; a literal matcher catches what models rarely emit and misses what they actually write) — pinned with a paraphrase regression fixture and ≥4 non-flagging tests. One rewrite pass, accepted only if violations decrease AND the story lint stays clean; cadence **degrades, never blocks** (unlike the story lint).
- **Claims routing:** read `server/claimsReviewRouter.ts` first and report how reviews are created and what populates `verdicts`. Route every successful youtube_script generation through that SAME creation path (no parallel claims engine), `contentType='youtube_script'` (per the Part 1 type probe: varchar → just write the value; enum → additive append with the DDL shown before running), `contentId=String(outputId)`, `contentTitle=title`. Because the review is an LLM call, run it **post-commit, best-effort, inside try/catch** — a claims-side failure must never destroy a saved script (this exact failure mode occurred). Script detail renders a claims badge — "Claims review: pending (N flags)" — linking to the existing Claims Review page, sourced by contentType+contentId. Never a generation gate; the operator is the qualified reviewer.

Acceptance: instance-based metric unit-tested; edit-then-save keeps the same metric (test); timestamp fixture test + idempotency test; paraphrase fixture caught, false-positives clean; a generation creates a claims row via the existing path (rules run mocked in tests, one live row shown), badge renders live counts; a mocked claims-side crash still leaves the script saved (test).

---

## PART 4 — FINAL REPORT + OPERATOR WALKTHROUGH

1. `git log --oneline` for the branch (raw) · PR link · sandbox URL.
2. Full vitest summary + `pnpm tsc --noEmit` raw; pre-existing env-dependent failures listed with proof they exist at `525780b`.
3. Migration/schema change table · files touched, one line each · deviations stated plainly, each with evidence.
4. The operator will personally run this at the sandbox URL — this, not your report, is the build: supercharge shows real chips and real error reasons → Generate panel shows exactly six inputs, Extract offer renders the real offer (name, deliverables, guarantee; unstated fields absent, not invented) → 15-minute, story-slot, research-on generation → script lands in Library with a winning-structure opening (no soft rhetorical question), a delimited story slot shaped to this script's symptoms, ≤3 tips each laddering to the offer, a CTA naming the offer + deliverables + guarantee, deterministic timestamps ending near 15:00, "X of Y sections grounded" with a Grounding disclosure naming any unfilled types, and a live claims badge. Read it aloud: zero banned stock phrases, zero invented patients.
