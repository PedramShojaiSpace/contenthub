# Kajabi OCU Price Test: $99 Digital Course vs. $199 Physical Offer

**Author:** Manus AI  
**Reference time:** 23 September 2026, 11:30 a.m. Central  
**Decision being modeled:** Whether the $199 physical one-click upsell can accept a lower take rate than the $99 digital Upstream Course and still be the stronger front-end choice.

## Conclusion

The answer depends on which form of “margin” matters.

If the goal is **gross cash collected at checkout**, the $199 offer can convert at only **49.75% of the $99 offer’s take rate** and still collect the same gross cash. In other words, the $199 offer can absorb a **50.25% relative conversion-rate decline** versus the $99 digital offer before gross checkout cash falls behind.

If the goal is **contribution after the stated $107 COGS reserve**, the answer reverses. Each $199 acceptance leaves **$92** after COGS, while each $99 digital acceptance leaves **$99**. Therefore, the $199 offer must convert **7.61% more often** than the $99 offer to create the same contribution. It cannot take a conversion hit on a true-margin basis.

> The $199 offer creates **$100 more gross checkout cash** per acceptance, but it also creates **$107 of COGS**. It is a working-capital choice, not a higher-contribution choice, unless its conversion rate exceeds the digital offer’s rate by at least 7.61%.

## Per-acceptance economics

| Measure | $99 Upstream digital OCU | $199 physical testing OCU |
|---|---:|---:|
| Checkout cash collected | $99.00 | $199.00 |
| Stated COGS reserve | $0.00 | $107.00 |
| Contribution after COGS | **$99.00** | **$92.00** |
| Difference in contribution per accepted offer | — | **-$7.00** |

This analysis uses the owner-provided $107 COGS for the $199 physical offer. It assumes no COGS for the digital $99 course and excludes payment processing, refunds, support, taxes, shipping variance, and acquisition spend.

## Exact conversion thresholds

Let **r99** be the $99 OCU take rate and **r199** be the $199 OCU take rate.

| Objective | Break-even formula | What the $199 offer must do |
|---|---|---|
| Same gross checkout cash | `r199 × $199 = r99 × $99` | `r199 ≥ 49.75% × r99` |
| Same contribution after COGS | `r199 × $92 = r99 × $99` | `r199 ≥ 107.61% × r99` |

The practical interpretation is straightforward. If $99 converts at 20%, $199 needs a 9.95% take rate to produce the same **gross cash**, but a 21.52% take rate to produce the same **contribution after COGS**.

| If $99 digital OCU converts at | $199 rate needed for equal gross cash | $199 rate needed for equal post-COGS contribution |
|---:|---:|---:|
| 10.00% | 4.97% | 10.76% |
| 15.00% | 7.46% | 16.14% |
| 20.00% | 9.95% | 21.52% |
| 25.00% | 12.44% | 26.90% |
| 30.00% | 14.92% | 32.28% |

## Applying the historical $199 evidence

The mature historical Meta/Agora Kajabi cohort recorded **14 immediate post-purchase accepts from 88 $67 buyers**, a **15.91%** take rate. Thirteen were $199 testing acceptances and one was the newer $99 digital offer. This is a directional historical base, not a clean current $99-versus-$199 randomized price test. [1]

At that 15.91% historical rate, the $199 offer produced the following per $67 buyer:

| Historical $199 economics per $67 buyer | Value |
|---|---:|
| Gross $199 OCU cash | $31.66 |
| COGS reserve | $17.02 |
| Contribution after COGS | **$14.64** |
| $99 take rate needed to equal $199 gross cash | **31.98%** |
| $99 take rate needed to equal $199 post-COGS contribution | **14.78%** |

So, if the digital $99 OCU can sustain at least **14.78%**, it produces more contribution per $67 buyer than the historical $199 physical OCU did at 15.91%. It would need to reach **31.98%** to match the $199 offer’s gross checkout cash per $67 buyer.

## Current live observation is not decision-grade yet

The direct Kajabi transaction API read through 23 September reports 23 $67 entry purchases, one $99 Upstream acceptance, and two $199 testing OCU acceptances. That creates a provisional $99 take rate of **4.35%** and a $199 take rate of **8.70%** if each is divided by the 23 $67 entries. Those figures are **not comparable decision data** because the $99 offer is newly placed, the sample contains only one $99 acceptance, both offers may be shown in the same purchase path, and the exposures are not known to be evenly allocated. [2]

Do not use the current $99 result to reverse the offer yet.

## Recommended decision rule

Use two separate scorecards for the test.

| Scorecard | Formula | What it answers |
|---|---|---|
| Gross cash per $67 buyer | `OCU take rate × checkout price` | How much checkout cash can temporarily support front-end ad spend? |
| Contribution per $67 buyer | `OCU take rate × (checkout price − COGS)` | Which OCU creates more actual economic capacity after the product cost reserve? |

The $199 physical offer should remain the preferred option only if it either meets the strategic need for gross working capital **and** remains above the gross-cash threshold, or it proves a contribution advantage by converting at least 7.61% more frequently than the $99 course. The $99 digital offer is structurally superior for contribution if its take rate is within 7.07% of the $199 offer’s take rate.

For a defensible result, hold the $67 entry offer, traffic source, checkout flow, offer order, and eligibility rules constant. Compare a $99 digital OCU arm and a $199 physical OCU arm with at least **50 paid $67 buyers per arm** before calling a directional result. Use Kajabi cleared exact-offer transactions rather than Meta Purchase value. The $199 COGS must be reserved at the same point in the calculation for every read.

## Basis, time, assumptions, and confidence

**Basis.** Gross cash is checkout revenue. Contribution is checkout revenue less only the stated $107 COGS. The analysis does not call gross cash “profit.”

**Time.** Historical comparison uses the mature Meta/Agora Kajabi cohort through 23 September 2026. The current offer read covers Kajabi transactions dated 20–23 September 2026 in Central Time.

**Assumptions.** The $99 course has zero COGS; the $199 physical offer has exactly $107 COGS; payment fees, refunds, taxes, shipping variance, support, and media expense are excluded from the unit calculation.

**Sources and confidence.** The historical take-rate evidence comes from first-party Meta-lead and Kajabi purchase matching. Current counts come from the direct Kajabi transaction API using exact offer IDs. The price and COGS threshold math is deterministic. Confidence is high in the arithmetic and limited in the current $99 performance because it has only one recorded acceptance.

No checkout, price, OCU, Kajabi, Klaviyo, ad, budget, or order setting was changed for this analysis.

## References

[1]: ./agora-kajabi-meta-cohort-downstream-analysis-2026-09-23.md "Agora Meta Lead Cohort: Kajabi Downstream Purchase Analysis"

[2]: ./kajabi-99-upstream-ocus-tracking-2026-09-22.md "Kajabi $99 Upstream OCU Tracking"

[3]: ./agora-199-ocus-take-rate-and-break-even-2026-09-04.md "Agora $199 One-Click Upgrade Economics"
