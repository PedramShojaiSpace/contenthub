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
