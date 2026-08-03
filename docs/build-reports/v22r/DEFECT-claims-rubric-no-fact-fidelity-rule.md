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

## Proposed fix (needs a decision, not just code)

Add an eighth rule, `offer_fact_fidelity`, that receives the source
`offer_profile` alongside the script and flags any offer specific in the
script that does not match the profile. Design notes:

- It needs a **second input**. Every existing rule reads only `content_text`.
  This one requires the offer profile the script was generated against, which
  means threading `analog_data_entries.offer_profile` (or the resolved tier)
  into the rubric call.
- Scripts generated with **no** offer bound must skip the rule rather than
  fail it, or every ungrounded draft flags spuriously.
- Numeric comparison should be exact-match on digit strings, not semantic.
  "22" vs "176" is the failure mode; a model asked to judge semantic
  equivalence may well rationalise a mismatch, as it did above.
- Consider whether this belongs in claims review at all, or as a separate
  pre-save gate in the generate path like the story-integrity lint. Claims
  review is post-hoc and advisory (`status: pending`); the story lint is a
  hard 422 before save. A wrong product spec arguably deserves the harder
  treatment.

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
