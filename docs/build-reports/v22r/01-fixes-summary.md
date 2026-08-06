# Part 1 — The eight verified fixes (plus one found while proving them)

Branch `feature/script-factory-v22`. Raw, reproducible output for every claim
below is in `01-fixes-proof.txt` (439 lines), regenerable with the four probe
scripts in this directory. No claim here is asserted without output.

## Result

| | Baseline at `525780b` | After Part 1 |
|---|---|---|
| `pnpm tsc --noEmit` | 22 errors | **22 errors** (identical files) |
| `pnpm test` files | 14 failed / 63 passed (77) | 14 failed / **64 passed (78)** |
| `pnpm test` tests | 34 failed / 1020 passed (1054) | 34 failed / **1038 passed (1072)** |

The 14 failing files are byte-identical to the baseline list and all fail for
missing third-party API keys in the sandbox (claudeLLM, dataForSeo,
gmail.credentials, googleDrive, heygen, kajabi, klaviyo, landingPages, metaAds,
pexels, substack.session, typeform, wordpress.publish, youtube). Net change:
**+1 test file, +18 tests, all passing; zero regressions.**

## The five vidIQ client fixes

All five sat in `server/vidiq.ts`. They compounded: fix 1 made fixes 3 and 4
invisible, which is why a single root cause presented as "Supercharge failed"
regardless of what actually went wrong.

**Fix 1 — `result.isError` was never checked.** An MCP tool failure arrives as
HTTP 200, with no JSON-RPC `error` member, and the reason in prose at
`content[0].text`. Every guard passed, the prose was handed to `JSON.parse`, and
the operator saw a `SyntaxError`. Proven live:

```
HTTP 200 · jsonrpc.error present: false · result.isError: true
MCP error -32602: Input validation error: Invalid arguments for tool vidiq_outliers:
  { "received": "video", "code": "invalid_enum_value",
    "options": [ "all", "long", "short" ], "path": [ "contentType" ] }
```

Now a typed `VidIQToolError` carries that text verbatim in `rawMessage`. Section C
of the proof shows `isVidIQToolError(err): true`, `err.name: VidIQToolError`, and
`err.name === "SyntaxError": false`.

**Fix 2 — structured data lives in `result.structuredContent`.** For several
tools `content[0].text` is markdown prose, so `JSON.parse` threw *on success*.
`vidiq_keyword_research` is the clearest case: its text begins
`Research for **gut health fatigue** found 10 related suggestions.` The contract
is now structuredContent → JSON.parse(text) → `{ _text }`, never a throw.

**Fixes 3 and 4 — wrong enum values.** Read from the server's own schemas via
`tools/list`: `vidiq_outliers.contentType` is `["all","long","short"]` and
`vidiq_trending_videos.videoFormat` is `["long","short"]` — note the second is
strictly narrower, so one shared constant would be wrong. Both were being sent
`"video"`. Both defaults are now `"long"`.

**Fix 5 — `vidiqBalance` read a key that does not exist.** Live payload:

```json
{ "type": "limited", "totalCredits": 5951, "renewableCredits": 5950,
  "maxRenewableCredits": 6000, "renewableResetsAt": "2026-09-01T13:56:05Z",
  "addOnCredits": 1, "maxAddOnCredits": 300 }
```

No `credits` at any level. Every pre-flight check compared `undefined < needed`,
which is always false, so a doomed batch fired every call instead of stopping at
the first. Now `spendableCredits()` is the single accessor, returning `null` for
unusable shapes so a guard can never silently pass. Three callers updated
(`scriptFactoryRouter` ×2, `topicTreeRouter` ×1).

## Fix 9 — field-name mismatch, NOT in the original defect list

Found because the first proof run printed every video title as `undefined`. The
interfaces declared `title` / `publishedAt` / `outlierScore`; the wire shape is
`videoTitle` / `videoPublishedAt` / `breakoutScore`, with **no `outlierScore` key
at any level**. `callVidIQTool` casts to the declared generic, so `tsc` could not
catch it, and the unit tests could not either — they used fixtures I had written
from the same wrong assumption. Only the live call exposed it.

Two further details the payload settled:

- The two tools disagree on the *type* of `videoPublishedAt`: outliers returns
  unix seconds (`1774063697`), trending returns ISO (`"2026-07-28T14:52:05.000Z"`).
  Both normalise to ISO in the wrapper so no caller branches on provenance.
- `channelId` and `subscriberCount` **are** present. A comment at the
  deep-research call site claimed they were "absent from VidIQ's payload" and
  hardcoded both to `null`. They were only ever reading as undefined because the
  whole object was mis-mapped.

Fix 9's tests use payloads copied verbatim from the live capture, not invented
ones. That is the lesson: a hand-written fixture proves only that the code agrees
with my assumption.

## The three schema declaration corrections (fixes 6, 7, 8) — zero DDL

Six column names in `drizzle/schema.ts` referenced columns that have never
existed. Every read and write against these three tables threw
`ER_BAD_FIELD_ERROR`, which is exactly why all three hold 0 rows.

| Table | Declared (wrong) | Live (correct) |
|---|---|---|
| `yt_transcripts` | `transcript_status` | `status` |
| `yt_transcripts` | `tr_created_at` / `tr_updated_at` | `created_at` / `updated_at` |
| `claims_reviews` | `cr_content_type` | `content_type` |
| `claims_reviews` | `cr_status` | `status` |
| `yt_video_outliers` | `outlier_created_at` / `outlier_updated_at` | `created_at` / `updated_at` |

Section D proves each one twice — the old name failing, the new name succeeding —
then round-trips a real INSERT/SELECT/DELETE against the scratch DB, because a
name-only change is easy to assert and only a successful write actually proves it.

`claims_reviews.content_type` had **two** stacked defects: the name was wrong AND
the type was wrong. The live column is `varchar(64)`, not an enum. The proof
inserts `content_type='youtube_script'` — a value outside the old declared enum —
and it is accepted. **Part 3E therefore needs no `ALTER TABLE`**, which matters
because it would otherwise have meant DDL on a table the operator has never
successfully written to.

Out of scope and deliberately untouched, listed for the record only:
`reddit_conversions.attributionType`, `apollo_sync_runs`,
`youtube_pipeline_videos`, `retreat_events`, `ab_tests`, `ab_conversions`,
`collective_sourcing_candidates`.

## Two findings that need an operator decision (not fixed here)

**1. `vidiq_outliers` ignores the keyword.** For `"leaky gut fatigue"` it returned
*Brud Sprunki EATS EVERYTHING* (`videoTopics: ["Video game culture"]`), a
drain-cleaning video, and a *News24* fuel-rationing clip. `vidiq_trending_videos`
on the same query returned *How To Heal 20 Years of Gut Damage in 30 Days*
(1548 vph) and *You Don't Need Fiber…* — genuinely on-topic. The spec designates
outliers as the primary research source and trending as the fallback; live
behaviour suggests the reverse. Deferred to Part 3C rather than changed
unilaterally, since it alters stated design.

**2. Fix 9 activated a sort that had never run.** The deep-research comparator is
`(b.outlierScore - a.outlierScore) || (b.views - a.views)`. With `outlierScore`
previously `0` on every row it always returned 0 — a silent no-op passing vidIQ's
own ordering through. It now reorders, verified in section B2:

```
v2.1 (score all 0) → by views:  329197, 104864, 76572, 51665, 44650
v2.2 (real scores) → by score:  330.3, 27.37, 23.43, 14.76, 8.23
```

This makes finding 1 worse: the new top-ranked row is a 92-minute unrelated video
scoring 330.3. Relatedly, `breakoutScore` is an unbounded
over-performance-vs-baseline figure, **not** a view multiplier, yet the UI renders
it as `` `outlier ${score.toFixed(1)}x` `` — displaying "330.3x", which is
meaningless. The `x` suffix is removed in Part 3E's honest-metrics work.
