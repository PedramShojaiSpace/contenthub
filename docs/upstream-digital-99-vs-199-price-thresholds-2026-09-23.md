# Upstream Digital Course: $99 vs. $199 Price-Test Thresholds

**Author:** Manus AI  
**Reference time:** 23 September 2026, 11:33 a.m. Central  
**Decision modeled:** Replace the $99 digital Upstream Course OCU with a $199 digital Upstream Course OCU.

## Direct answer

Yes. If the Upstream course remains a **digital product with no incremental COGS**, moving it from **$99 to $199** is economically attractive unless the $199 version converts at less than **49.75% of the $99 version’s take rate**.

Equivalently, the $199 digital course can absorb a **50.25% relative decline in conversion rate** and still generate the same cash and contribution per $67 buyer as the $99 version. Because both offers are assumed to have zero incremental COGS, **gross checkout cash and contribution are the same comparison**.

> This is materially different from the earlier $199 physical testing offer. The physical offer had $107 COGS. A $199 digital course retains the entire additional $100 of checkout cash as contribution before payment fees and support costs.

## The equation

Let `r99` be the $99 OCU take rate and `r199` be the $199 OCU take rate.

```text
$99 digital cash per $67 buyer  = r99 × $99
$199 digital cash per $67 buyer = r199 × $199

Break-even: r199 = r99 × ($99 ÷ $199)
Break-even: r199 = r99 × 49.75%
```

The $199 version wins when:

```text
r199 > 49.75% × r99
```

## Practical thresholds

| If the $99 course converts at | The $199 course needs at least | Allowable relative take-rate decline |
|---:|---:|---:|
| 10.00% | 4.97% | 50.25% |
| 15.00% | 7.46% | 50.25% |
| 20.00% | 9.95% | 50.25% |
| 25.00% | 12.44% | 50.25% |
| 30.00% | 14.92% | 50.25% |

For example, if the $99 OCU ultimately converts at 20.00%, the $199 digital OCU only needs to convert at 9.95% to create the same $39.80 of cash and contribution per $67 buyer. Any $199 take rate above 9.95% is economically better on a per-entry-buyer basis.

## Historical reference point

The mature historical Kajabi cohort recorded a 15.91% immediate post-purchase take rate for the prior $199 offer. At a 15.91% $199 digital take rate, the course would contribute **$31.66 per $67 buyer**. To match that, the $99 digital course would need a **31.98%** take rate. [1]

This is an illustrative benchmark only. The old $199 result principally represents a different physical testing offer, not the Upstream course at a higher price. It should not be treated as the forecast for a $199 Upstream digital offer.

## What should be measured

Treat this as a clean price test, not a comparison between different offers. The course content, OCU placement, buyer eligibility, landing-page language, checkout sequence, and traffic source must remain fixed. The only change should be the course price.

| Measure | Formula | Decision use |
|---|---|---|
| $99 digital take rate | $99 acceptances ÷ paid $67 buyers exposed to $99 | Price-arm conversion |
| $199 digital take rate | $199 acceptances ÷ paid $67 buyers exposed to $199 | Price-arm conversion |
| Contribution per $67 buyer | `price × take rate` | Primary winner metric, assuming no incremental COGS |
| Cash per $67 buyer | `price × take rate` | Same as contribution under the stated zero-COGS assumption |

A practical directional-read threshold is **50 paid $67 buyers per price arm**. Keep the price test running until that threshold is met in each arm. Record the exact Kajabi offer ID, accepted order count, refund count, and cleared revenue for each arm. Use Kajabi cleared transactions as the financial authority; do not use Meta Purchase value.

## Basis, time, assumptions, and confidence

**Basis.** This is a unit-economics comparison of two versions of the same digital Upstream course offered as a one-click upsell after the $67 entry purchase.

**Time.** The calculation is current as of 23 September 2026. The present $99 offer has only one recorded acceptance and is not decision-grade.

**Assumptions.** The $99 and $199 Upstream course versions have zero incremental COGS. Payment processing, refunds, support costs, taxes, and media spend are excluded. If any incremental course-delivery cost exists, deduct it from both price points before using the threshold.

**Sources and confidence.** The price arithmetic is deterministic. The historical $199 take-rate context comes from first-party Kajabi cohort matching. Confidence is high in the break-even threshold and low in any forecast of the new $199 Upstream take rate until randomized exposure data is available. [1] [2]

No offer, price, OCU placement, checkout, Kajabi setting, Klaviyo flow, ad, or budget was changed for this analysis.

## References

[1]: ./agora-kajabi-meta-cohort-downstream-analysis-2026-09-23.md "Agora Meta Lead Cohort: Kajabi Downstream Purchase Analysis"

[2]: ./kajabi-99-upstream-ocus-tracking-2026-09-22.md "Kajabi $99 Upstream OCU Tracking"
