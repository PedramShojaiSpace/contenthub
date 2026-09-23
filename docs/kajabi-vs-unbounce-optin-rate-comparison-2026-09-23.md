# Kajabi vs. Unbounce: Paid Opt-In Rate Comparison

**Author:** Manus AI  
**Checked:** September 23, 2026  
**Measurement window:** September 21–22, 2026, two complete Meta account calendar days (America/Chicago)

## Bottom line

Using the best currently comparable paid-traffic denominator, the two pages are **effectively tied on first-party opt-in rate**. The Kajabi screening page recorded **205 completed opt-ins from 671 Meta landing-page views (30.55%)**. The Unbounce LP-3 page recorded **125 completed opt-ins from 425 Meta landing-page views (29.41%)**.

Kajabi is ahead by **1.14 percentage points**, while Unbounce is approximately **3.7% lower relative to Kajabi**. That is too small to call a layout winner at this sample size. The approximate 95% interval for the observed difference spans **–4.42 to +6.70 percentage points**, meaning the current data is compatible with either page being modestly better.

| Metric | Kajabi screening page | Unbounce LP-3 | Difference |
|---|---:|---:|---:|
| Paid Meta landing-page views | 671 | 425 | — |
| First-party completed opt-ins | 205 | 125 | — |
| **First-party opt-in rate** | **30.55%** | **29.41%** | **Kajabi +1.14 pp** |
| Meta-reported Leads | 479 | 184 | — |
| Meta-reported Lead ÷ LPV | 71.39% | 43.29% | Kajabi +28.09 pp |
| Link clicks | 1,075 | 617 | — |
| Landing-page-view rate from clicks | 62.42% | 68.88% | Unbounce +6.46 pp |
| Media spend | $615.26 | $385.70 | — |
| Spend per landing-page view | $0.92 | $0.91 | Essentially even |
| Spend per first-party opt-in | $3.00 | $3.09 | Kajabi $0.08 lower |

## How to read the comparison

The **30.55% versus 29.41%** result is the decision-useful number. It divides first-party, distinct completed opt-ins by Meta’s `omni_landing_page_view` count for the paid campaigns assigned to each page. Meta defines a landing-page view as a click that successfully loaded the website destination, so it is a materially better paid-visit denominator than a raw link click.[1]

The Kajabi numerator is the `kajabi` path recorded with the Kajabi-page campaign identity. The Unbounce numerator is the `ko_klaviyo` path, including the native Unbounce capture records tied to the LP-3 destination. This preserves every completed first-party lead rather than treating an incomplete UTM relay as a lost opt-in.

The very high **Meta-reported Lead ÷ LPV** rates should **not** be used to decide which page converts better. Meta reports 479 Kajabi Leads and 184 Unbounce Leads in this window, while the first-party ledgers record 205 and 125 completed opt-ins. Those event counts are useful diagnostics, but they are not reconciled enough to be the source of truth for page conversion.

## What the layout result means now

The evidence does **not** show that the Kajabi layout is materially beating Unbounce on the opt-in itself. It also does not show that Unbounce is the better opt-in page. The 1.14-point observed gap is within ordinary sampling variation at the current volume.

Unbounce does have a higher click-to-loaded-page rate: **68.88%** versus Kajabi’s **62.42%**. That is a load/redirect-health signal rather than proof of page persuasion. The spend per landing-page view is essentially identical, so there is no obvious paid-delivery distortion in this two-day read.

## Recommendation

Keep the landing-page comparison open until each arm has at least **1,000 paid landing-page views** under the same audience, creative, placement, optimization, and attribution settings. At the observed rates, that is the approximate threshold at which a 3–4 percentage-point opt-in gap becomes more actionable.

For a durable dashboard, record a first-party page-view event before each form loads, with a stable `landing_path` of `kajabi_screening` or `unbounce_lp3`, a first-party visitor ID, and the Meta campaign/ad-set IDs. Then report **unique first-party visitors → unique first-party opt-ins**. That would eliminate dependency on Meta’s reported landing-page-view metric and cleanly separate organic/direct traffic from paid traffic.

## Scope and limits

This is an **opt-in-only** comparison. It does not decide the higher-value question of which path produces better paid buyers, revenue, or Upstream OCU adoption. Those outcomes must remain in separate, age-matched cohorts because the checkout path changed from Shopify to Kajabi on September 23.

The first-party Unbounce ledger is complete for lead capture but historic Unbounce records use a mix of `meta`, `facebook`, and `unbounce` source labels. The report therefore counts the known LP-3 path, not only rows whose source string literally says `meta`. Kajabi records the relevant source as `kajabi_page`, so it is likewise treated as the known paid screening path rather than discarded for lacking a literal Meta source label.

## References

[1]: https://www.facebook.com/business/help/172641445757289 "Understand the difference between link clicks and landing page views"
