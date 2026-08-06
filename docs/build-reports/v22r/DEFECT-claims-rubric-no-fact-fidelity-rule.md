# Defect — the claims rubric cannot catch a wrong product fact

Status: LOGGED, NOT FIXED. Raised during v2.3 Part 0. Deliberately not fixed
inside a bug-check task because it changes what claims review means.

## What happened

Script id=1 stated the product was a "KBMO FIT 176 food inflammation test
(176 foods, IgG + complement C3)". The real product, per the source sales
page, is the "KBMO FIT 22 & Gut Barrier Permeability Panel" screening 22
primary inflammatory food triggers. A claims review row was created for that
script and the rubric ran successfully.

It passed the wrong figure. Verbatim from `claims_reviews.verdicts` id=1:

> "The KBMO FIT 176 and related labs are described as testing plus
> interpretation and not as directly fixing, curing, or treating a
> condition." — ruleId `diagnostic_as_treatment`, **passed: true**

The rubric read the wrong number, reasoned about it correctly against its own
rule, and returned a pass. Nothing was wrong with the rubric's logic. The rule
set simply has no concept of whether the fact is true.

## Why it cannot catch it

All seven rules are medical-compliance rules:

| ruleId | checks |
|---|---|
| `disease_treatment_claim` | claims to treat/cure/prevent a named disease |
| `guaranteed_outcome` | promises a specific health result |
| `undisclosed_testimonial` | testimonial without results-vary disclaimer |
| `diagnostic_as_treatment` | diagnostic framed as a fix |
| `missing_disclaimer` | educational-purposes disclaimer absent |
| `physician_endorsement_implied` | credentials used as outcome guarantee |
| `fda_unapproved_claim` | supplement structure/function claim |

Every one asks "is this sentence legally risky?" None asks "is this sentence
true of the product being sold?" A wrong panel name, an inflated food count,
a misquoted price or an invented turnaround time is not legally risky in the
rubric's terms, so it passes — while being exactly the kind of error that
misrepresents a purchase to a real buyer.

This is a **fidelity** defect, not a **compliance** defect, and the system
currently checks only the latter.

## SPEC — decided 2026-08-03, build AFTER v2.3 ships

The three open questions below were put to the operator and answered. This is
now a specification, not a proposal. It is deliberately scheduled as its own
item after v2.3 rather than inside it.

### 1. Threading — pass it in, do not re-derive

The offer profile is already in scope at generation time, so it is passed into
the rubric path as an **optional second input** rather than re-fetched or
re-derived inside the rubric. Re-deriving would mean a second read of
`analog_data_entries.offer_profile` that could disagree with the one the
script was actually generated against — the tier resolution in particular is
a decision made once at generation time and must not be recomputed later.

Signature shape: the shared creation path gains an optional
`offerProfile?: OfferProfile | null` argument. Non-script content types pass
nothing and are unaffected.

### 2. Skip condition — `not_applicable`, never `passed`

When a script has no bound offer — null profile, or a ladder that resolved to
`tier_not_chosen` — the rule is **skipped entirely and reported as
`not_applicable`**. It must never report `passed`.

> Operator's reasoning, recorded verbatim because it is the load-bearing part:
> "A silent pass on an unchecked script is how a fidelity gap hides."

This means the verdict enum needs a third state. A boolean `passed` field
cannot express "not checked", and coercing it to `true` reproduces exactly the
dishonesty that the v2.2 grounding metric was rewritten to remove (100% of
zero reading as perfect).

### 3. Severity — advisory, but its own prominent badge

**Advisory, not a hard 422.** The distinction the operator drew:

| | story integrity | offer fact fidelity |
|---|---|---|
| nature | legal hazard | correctness problem |
| a fabricated patient / a wrong panel number | must never be saved | must be seen and fixed |
| enforcement | hard 422 before save | advisory flag after save |
| remedy | regenerate | edit the wrong value |

A wrong panel number does not justify discarding a 2,000-word script and
burning a full regeneration; it justifies changing two characters. So it is
surfaced, loudly, and left to the operator.

Surface as a **separate badge in the workspace right rail** — "Offer fidelity:
2 flags" — distinct from the claims-review badge, not folded into it. The two
answer different questions and must not be conflated. Expanding the badge
lists each mismatch as:

- the claimed value as it appears in the script,
- the profile value it should have matched,
- the section it appeared in (e.g. "Teach 3").

### Implementation notes carried forward

- Numeric comparison must be **exact-match on digit strings**, not semantic. A
  model asked to judge equivalence will rationalise a mismatch — it already
  did exactly that above, reasoning fluently about "FIT 176" and passing it.
- The section attribution needs `parseSectionInstances`, so this depends on
  the v2.3 Part 1 server-side section parser being in place. Another reason to
  build it after v2.3, not during.

## Why it is logged rather than fixed

Three reasons. It widens claims review's contract from compliance to fidelity,
which is a product decision. It requires a new input threaded through the
rubric call, touching the shared `runRubricOnContent` path used by non-script
content types. And the immediate incident had a simpler cause — wrong seed
data, fixed in `becf7a1` — so shipping a rubric change under the banner of
"fixing FIT 176" would overstate what was actually broken.

## Evidence

```
$ mysql -N -e "SELECT id, content_type, content_id, status FROM claims_reviews;"
1   youtube_script   1   pending
2   youtube_script   2   pending
3   youtube_script   3   pending

$ mysql -N -e "SELECT LOCATE('176', content_text), LOCATE('176', verdicts) FROM claims_reviews WHERE id=1;"
8268    1045
```

The wrong figure is present in both the reviewed text and the rubric's own
reasoning, and the review still passed.
