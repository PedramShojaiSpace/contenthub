# Interconnected OCUS Take-Rate — Entity Card

| Field | Definition |
| --- | --- |
| Entity | Interconnected All-Access $67 entry offer and downstream OCUS offer |
| Objective | Measure the early attachment of the $199 one-click offer to paid $67 entry buyers without pooling Kajabi and KO/Klaviyo paths |
| Entry denominator | Unique paid $67 Interconnected buyers, excluding duplicates and non-$67 bundle offers |
| OCUS numerator | Unique entry buyers with a later paid downstream OCUS purchase, identified by order value and offer name; no inferred joins |
| Reporting period | Purchases recorded from 2026-08-01 through the current analysis date |
| Source hierarchy | Kajabi purchase webhook records for Kajabi orders; Shopify attributed sales for Shopify orders; source-specific reporting only |
| Current caveat | The first-party Kajabi records contain historical $299 OCUS-labeled purchases but no recorded $199 OCUS purchase at the time of analysis; the current $199 page may be too new or its order webhook mapping may be incomplete. |
| Decision boundary | Report a baseline and attribution limits only; do not change the $199 price, OCUS page, checkout, or funnel. |

## Early Baseline

The Kajabi paid-order records identify **15 unique $67 Interconnected entry buyers** from the current recorded cohort. None subsequently recorded a $199 downstream purchase in the same `interconnected` funnel source. The observed early $199 take rate is therefore **0.0% (0 / 15)**.

The same source contains four historical $299 OCUS-labeled purchases across two offer names, but none matches a recorded $67 entry buyer after that buyer’s entry purchase. Those $299 records cannot be treated as a $199 take-rate numerator, and they do not alter the 0 / 15 $199 baseline.

The calculation is directional rather than a mature cohort result: recent $67 orders have not all had a full 14-day observation window, Kajabi records do not currently show a $199 OCUS purchase, and the current Shopify attributed-sales table contains no matching August $67 or $199 Interconnected order. Before judging the new $199 page, persist the original CRM path, price cell, entry-order ID, OCUS-view timestamp, $199 checkout touch, downstream order ID, payment status, and refund status on the same buyer-level record.

## Historical-Source Reassessment

The authenticated Interconnected Command Center remains configured around a **legacy $299 Upsell** primary KPI. Its current-day dashboard reported 0 upsells, 0 Kajabi revenue, and no sales by tier, while the scorecard displayed 7 buyer matches from the selected lead cohort but $0 recorded revenue. This confirms the view is useful for current operational monitoring but is not a sufficient historical $199 OCUS source of truth. The historical reconstruction must use the direct Kajabi transaction endpoint—already implemented in the protected `kajabiSalesRouter`—and distinguish it from the webhook capture table that initially undercounted the user-observed $199 purchases.

## Corrected Historical Result

The authenticated month-to-date Command Center calls the direct Kajabi transaction source and reports **16 paid $67 Interconnected Bundle OTO transactions** and **4 paid $299 Gut Permeability + Food Sensitivity Test with Coach upsells**. The historical paid upsell attachment is therefore **25.0% (4 / 16)** for the previous **$299** OCUS—not 0%.

This corrects the prior webhook-only 0 / 15 conclusion, which was incomplete. The direct Kajabi source is the authoritative source for the historical transaction count because it scans the site-level Kajabi transaction feed rather than relying solely on inbound purchase webhooks. However, it also reveals a critical pricing distinction: the historical four upsells were recorded at **$299**, not $199. The current $199 OCUS therefore has **no mature direct-transaction sample yet**; it should not be judged against the prior 25.0% $299 attachment until at least one full 14-day cohort is available. The prior webhook-table result is retained only as a data-capture gap, not as a conversion result.

## Reporting-Surface Deployment Check

The production Command Center still rendered the legacy `$299 Upsell` card immediately after the source correction. This is expected before the corrected client bundle is checkpointed and published; it is not evidence that the corrected source change failed. The local source now separates a current $199 webhook-confirmed KPI from the historical $299 benchmark. Production verification remains pending the published bundle.
