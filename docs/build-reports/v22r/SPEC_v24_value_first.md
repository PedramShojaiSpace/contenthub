BUILD PROMPT — Script Factory v2.4: Value-First Sell Density

Read `docs/build-reports/v22r/SPEC.md` and `SPEC_v23.md` from disk before starting. Commit this
document as `docs/build-reports/v22r/SPEC_v24_value_first.md` before writing code, and re-read it at
the start of every Part. All standing directives remain in force: read before modifying, push after
every part, raw output with every claim, redeploy the sandbox and post "now clickable" when parts
land.

**Scope wall:** `server/scriptFactoryRouter.ts` (+ test), `client/src/pages/ScriptFactory.tsx` +
components under `client/src/components/scriptFactory/`, `server/routers.ts` (wiring). **No schema
changes** — `ctaStyle` rides inside the existing `generation_params` json.

**Context — operator verdict on a full generated script:** too salesy for YouTube. The audit of the
actual output: the branded product is named or pitched in 8 of 13 sections; the full deliverables
list is restated four times (Proof, Objection 1, Teach 6, CTA); sales-page urgency language ("you
cannot go on living this way," "slots are limited") appears mid-teach. This is the 3B offer-binding
rules — "teaching builds toward targetAction," "every tip connects back to the offer" — behaving as
written. Those rules are correct for direct-response formats and wrong for YouTube long-form, where
sell density kills retention. The operator's requirement: **one full CTA at the end, at most one
short soft mention mid-script, and everything else pure value.**

---

## PART 0 — SEED VERIFICATION (before any build work)

The operator's style feedback was given against pre-fix script #1 (it references FIT 176). Confirm
the rebuilt sandbox generates from the corrected seed:

1. Print the live `offer_profile` on the seeded analog entry — raw. It must say FIT 22 and carry both
   guarantees per commit `becf7a1`.
2. `grep -c 176` on the committed `scripts/seed-data/salespage_verbatim.txt` → must be 0.
3. If either check fails, the reset rebuild re-introduced stale data — stop and fix the seed before
   Part 1, and report how it regressed.

### PART 0 RESULT (recorded 2026-08-05, after sandbox reset #2)

**Both checks PASS. No seed regression from either reset.**

Check 2 raw:

```
$ grep -c 176 scripts/seed-data/salespage_verbatim.txt
0
$ grep -n "176" scripts/seed-data/salespage_verbatim.txt
(no matches)
```

Check 1 raw — `analog_data_entries.offer_profile` (id=1, type=sales_page):

```json
{
  "tiers": [
    {
      "offerName": "KBMO Clinical Ecosystem — Diagnostic Intake",
      "offerType": "service",
      "deliverables": [
        "KBMO FIT 22 & Gut Barrier Permeability Panel, shipped directly to your door",
        "Screens 22 primary inflammatory food triggers",
        "Measures Zonulin/Occludin for leaky gut",
        "Clinical-Grade Gut Biome Test Kit — a simple, painless at-home collection kit, no doctor's office required",
        "Full Lab Analysis & Detailed Report — comprehensive report of your exact gut health markers, colour-coded red, yellow and green",
        "1-Hour Private 1-on-1 Clinical Health Coach Session reviewing YOUR specific results",
        "Personalized Upstream Action Plan detailing your exact food sensitivity triggers and gut barrier status"
      ],
      "guarantee": "100% Money-Back Guarantee. Plus the No-Rejection Guarantee: regardless of whether you qualify for the 6- or 12-month programs, you walk away with your complete food sensitivity report, leaky gut markers, and a personalized Upstream Action Plan.",
      "timeline": "Results in 3–5 Weeks",
      "pricePoint": "$399",
      "primaryCtaUrl": null,
      "targetAction": "Order the $399 Clinical Ecosystem kit and reserve a clinical coaching slot"
    }
  ]
}
```

FIT **22**, both guarantees present as separately named promises, `$399`, en-dash intact in
"3–5 Weeks" (charset conversion working).

**Method caveat recorded so the raw output is not misread:** an initial `grep "FIT ?[0-9]*"` matched
nothing, which looks like a failure and is not — BRE treats `?` literally and the stored string is a
plain "FIT 22". Reported here because a bare "no matches" would have been misleading.

**Constraint this places on v2.4 acceptance:** only ONE tier is stored. The committed
`salespage_verbatim.txt` is the Diagnostic Intake page alone, so the 3-tier ladder described in
`proof_3b_offer_tiers.txt` is not in this seed. Tier selection is therefore unambiguous
(`single_tier`), and the walkthrough's "FIT 22, both guarantees, $399" is exactly what the CTA must
reproduce. **Multi-tier CTA binding is not exercised by this build's live run** — that gap is stated
rather than papered over.

---

## PART 1 — THE `ctaStyle` PARAMETER

Add to `generate` input: `ctaStyle: z.enum(["value_first","balanced"]).optional()`.

- **Default resolution:** `youtube_script` and `podcast_outline` default to `value_first`. `email`,
  `ad_copy`, `sales_page_section`, `short_form` default to `balanced` and ignore a `value_first`
  request with a noted warning in the response — those formats are direct-response by nature and the
  current 3B behavior is correct for them.
- `balanced` = exactly today's behavior, byte-for-byte unchanged prompts. Regression tests must prove
  non-youtube formats are untouched.
- Store the resolved value in `generation_params.ctaStyle`. Variants inherit it unless overridden;
  **section regeneration inherits the parent script's `ctaStyle`** and applies the section rules
  below to the regenerated section.

## PART 2 — THE VALUE-FIRST CONTRACT (system-prompt block, replaces the 3B offer-pressure rules when active)

When `ctaStyle === "value_first"`, the offer block and free-value guard are replaced by a
`=== VALUE-FIRST SELL POLICY ===` block enforcing:

1. **Exactly one full CTA, in the `[CTA]` section only.** Every 3B fidelity rule still applies there:
   offer name, ≥2 deliverables reproduced faithfully, guarantee as written, price. Fact fidelity is
   not relaxed — it is concentrated.
2. **Exactly one mid-script soft mention.** Maximum 2 sentences. Placed after a major value payoff,
   between roughly 40% and 60% of the runtime. It may name the product once. It may NOT include
   price, deliverables, urgency, or a purchase instruction. Its register is a signpost, not a pitch —
   e.g., "The panel I use with patients for exactly this is called [name] — I'll walk you through it
   at the end. Back to the mechanism." Then the script returns to teaching.
3. **Teaching sections carry zero product presence.** No brand names, no deliverables, no "when
   paired with [product]" pivots, no value-stack language. Category-level references ("proper
   food-inflammation testing," "a structured reintroduction protocol") are allowed when the mechanism
   genuinely requires them.
4. **Objection sections become buyer's-guide education.** Instead of "why OUR offer is different,"
   they teach how to evaluate *any* solution in the category — what separates useful testing from
   dashboard theater, why interpretation matters, what questions to ask of any provider. No brand
   naming. The differentiation this builds gets cashed in once, at the CTA.
5. **The authority/[PROOF] section establishes credibility without pitching.** Who the speaker is,
   why they've earned the viewer's attention, and at most a forward promise ("at the end I'll tell
   you exactly what I use"). No deliverables, no price, no offer description.
6. **Urgency and scarcity language is confined to the `[CTA]` block.** None anywhere else —
   mid-script urgency is what makes value content read as an infomercial.
7. **Free value is genuinely free.** Practical protocols and tips must be complete and useful
   standing alone — no per-tip sales taglines. The honest scoping of what self-help can and can't
   reveal happens exactly once, in a single bridge paragraph immediately before the CTA (e.g.,
   "tracking shows you the pattern; it can't show you the immune response behind it — that's what
   testing is for"). That bridge is the only sanctioned pivot in the script.

## PART 3 — THE SELL-DENSITY LINT (post-generation, value_first only)

After generation, scan everything outside the `[CTA]` section and count: branded product-name
mentions, deliverables-list occurrences, price mentions, and urgency/scarcity phrases (build the
phrase list from the bound offer profile plus a small static set — "slots are limited," "don't wait,"
"you cannot go on").

**Budget:** ≤1 branded mention outside CTA (the mid-roll), 0 deliverables lists, 0 prices, 0 urgency
phrases.

Over budget → one targeted rewrite pass on the offending sentences only, accepted only if it reaches
budget AND the story-integrity and cadence lints remain clean. If still over after one pass, **save
the script with a visible advisory** — "Sell density over budget: N mentions outside CTA" — in the
response and the workspace right rail; do not hard-fail (a slightly salesy script is editable; a
destroyed generation is not). Report in every value_first response: mention count, mid-roll placement
as a percentage of runtime, and the lint outcome.

## PART 4 — UI

- Generate panel: a Style selector (Value-first / Balanced) visible for youtube_script only,
  defaulting to Value-first, with one-line descriptions ("One CTA at the end, pure value throughout"
  / "Offer woven throughout — for direct-response formats").
- The workspace Change-parameters regenerate panel includes the same selector, pre-filled from the
  source script's `generation_params` — so the operator can take an existing salesy script and
  produce a value-first variant in two clicks.
- The right rail shows the sell-density report for value_first scripts: "1 mid-roll mention at 47% ·
  CTA at 22:49 · within budget."

---

## ACCEPTANCE

- [ ] Mocked-LLM prompt assertions: value_first youtube generation contains the VALUE-FIRST SELL
      POLICY block and does NOT contain the balanced-mode offer-pressure instructions; balanced email
      generation is byte-identical to pre-v2.4 (fixture diff).
- [ ] Lint tests: a fixture script with product mentions in five sections → rewrite pass → ≤1 outside
      CTA; a compliant fixture passes untouched; the still-over-budget path saves with the advisory
      (no hard fail).
- [ ] CTA fidelity preserved under value_first: offer name, ≥2 deliverables, guarantee, price all
      present in the CTA (test).
- [ ] Mid-roll constraints tested: ≤2 sentences, no price/deliverables/urgency, placement between
      40–60% asserted on the live smoke generation.
- [ ] Section regeneration on a value_first script applies the section rules (test: regenerating a
      teach section with a mocked violating draft triggers the lint path).
- [ ] `generation_params.ctaStyle` stored; variants inherit; override works (tests).
- [ ] Non-youtube formats regression-proven unchanged.

## OPERATOR WALKTHROUGH (at the sandbox URL)

1. Open the existing long script → Change parameters → Style: Value-first → regenerate as a variant.
2. Read it: teaching sections clean of the brand, objections reframed as buyer's-guide education,
   exactly one two-sentence mid-roll signpost near the middle, urgency nowhere until the CTA, the CTA
   itself fully bound — correct panel name (FIT 22), deliverables, both guarantees, $399.
3. Right rail shows the sell-density report, within budget.
4. Generate one email from the same idea → confirm it still sells throughout (balanced untouched).

## FINAL REPORT

Part 0 seed verification raw output; `git log --oneline`; vitest summary + `pnpm tsc --noEmit` raw;
files touched; deviations stated plainly. Push, redeploy, post "now clickable."

---

## DECISIONS TAKEN DURING THE BUILD (appended as they are made, per the v2.3 directive)

### D1 — the format enum covers every format the brief names (verified, no gap)
Checked before writing the resolver rather than assumed. `SCRIPT_FORMATS` in
`server/scriptFactoryRouter.ts:197` is:

```ts
const SCRIPT_FORMATS = [
  "youtube_script", "short_form", "email", "ad_copy", "sales_page_section", "podcast_outline",
] as const;
```

All six formats named in the brief's default-resolution rule exist, `podcast_outline` included. The
resolver therefore covers the enum exhaustively with a `Record<ScriptFormat, CtaStyle>` so that
adding a seventh format becomes a compile error rather than a silent fallthrough to `balanced`.
