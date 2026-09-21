# Kajabi versus Klaviyo/Shopify: Launch-Window ROAS Snapshot

**Author:** Manus AI  
**Snapshot time:** 21 September 2026, approximately 3:06 p.m. Central  
**Reporting window:** From the first recorded Klaviyo/Shopify lead at 11:07 a.m. Central on 20 September through the snapshot time on 21 September. Meta spend is available at calendar-day granularity for 20–21 September; first-party leads and orders use the exact launch timestamp.

## Current answer

**Kajabi is ahead at this early reading.** On revenue that can be linked to a lead acquired in the same launch window, Kajabi has **0.90 booked ROAS** and the Klaviyo/Shopify path has **0.39 booked ROAS**. Kajabi is ahead by **0.51 ROAS points**, or approximately **2.3×**.

The important nuance is that this is a **directional launch snapshot**, not a test verdict. Neither arm has reached the 250 qualified-lead minimum, and the oldest lead is only about one day old. The operating decision rule remains 250 qualified leads per arm plus a 14-day purchase window before declaring a winner.[1]

## Matched-cohort comparison

| Measure | Kajabi control | Klaviyo → Shopify challenger | What it means now |
|---|---:|---:|---|
| Paid-media spend | $519.77 | $341.67 | Meta delivery spend, limited to the known current destination markers. |
| First-party leads | 147 | 102 | Kajabi leads use `funnel_path = kajabi`; challenger leads use `funnel_path = ko_klaviyo`. |
| First-party CPL | $3.54 | $3.35 | Acquisition efficiency is effectively similar; the current gap begins after the opt-in. |
| Paid buyers matched to the same launch cohort | 7 | 2 | Kajabi purchase records and paid Shopify orders, respectively. |
| Matched paid revenue | $469.00 | $134.00 | This is the booked revenue used for the ROAS comparison. |
| Lead-to-buyer conversion | **4.76%** | **1.96%** | Kajabi is ahead by 2.80 percentage points at this immature stage. |
| Buyer CPA | $74.25 | $170.84 | Spend divided by matched paid buyers. |
| Revenue per first-party lead | $3.19 | $1.31 | Kajabi is currently 2.43× higher. |
| **Booked ROAS** | **0.90** | **0.39** | Kajabi currently leads by 2.30×. |

The Kajabi arm is converting better after the lead arrives; it is **not** winning because it is buying dramatically cheaper leads. This distinction matters because it points to the downstream purchase experience, follow-up, offer sequence, or cohort mix—not simply media cost—as the active gap.

## Revenue authority and why the headline is conservative

For the Kajabi arm, the matched cohort contains seven recorded $67 purchases totaling $469. For the challenger, Shopify confirms two paid, non-cancelled $67 Interconnected orders matched to the 102 Klaviyo/Unbounce leads, totaling $134. No $199 Zipify acceptance is present in the challenger’s matched revenue at this snapshot.

The direct Kajabi transaction read shows **15 successful/non-refunded $67 transactions and two $199 OCUS transactions**, totaling **$1,403** across the same two calendar dates. It would be incorrect to divide that $1,403 by current control spend and call the result current-control ROAS. Only $469 of that revenue can be joined to a lead acquired in the current launch window. The remaining $934 may include buyers acquired before this window, returning buyers, or transactions whose source has not yet been joined. It must not be credited to this comparison.

> **Do not use Meta’s Purchase or purchase-value column as the revenue authority for this decision.** Meta currently reports 36 purchases and $2,940 for the Kajabi-marked delivery and four purchases and $268 for the challenger-marked delivery. Those values are diagnostic platform attribution, not reconciled cash. The table above uses first-party Kajabi/Shopify revenue instead.

## What the paid-media snapshot contains

The report classifies delivery by the live destination marker in each campaign or ad-set name. Rows containing `ic-interconnected-free-screening-Meta` are treated as the Kajabi control. Rows containing `interconnected-lp-3` are treated as the Klaviyo/Shopify challenger. Two VIBE campaigns totaling $381.99 spend are excluded because they use neither destination marker and therefore cannot be safely assigned to either arm.

The challenger has 102 first-party leads, all of which were successfully synced to Klaviyo and sent one Lead event. Fifty-one of these records carry the clean challenger UTM contract; the other 51 use the early native Unbounce fallback label. The lead split is visible for transparency, but both groups are in the same live Klaviyo/Shopify purchase path.

## How far apart the paths are

The largest current distance is the **post-lead buyer rate**. If the challenger were converting its 102 leads at Kajabi’s current 4.76% rate, it would have approximately five buyers rather than two. At the same $67 entry price, that is roughly $335 in entry revenue rather than $134 before any $199 post-purchase attach. This is an illustrative same-price comparison, not a forecast.

The gap is still too immature to attribute to one cause. The challenger began later, has one day of follow-up maturity, includes early fallback-tag traffic, and has not yet recorded a $199 post-purchase acceptance. Kajabi’s direct offer read includes $199 revenue, but that revenue is not connected to this exact same-day lead cohort and is therefore not used to inflate the control result.

## Recommended interpretation

The practical conclusion is: **Kajabi has the better early post-opt-in economics, while the Klaviyo/Shopify path is not yet mature enough to be judged as a permanent loser.** Keep the two revenue ledgers separate, let the current cohorts age, and evaluate again when both arms have at least 250 first-time qualified leads and the newest included lead has had 14 full days to purchase.[1]

Until then, the live scorecard should show these four first-party measures side by side: paid-media spend, unique first-party leads, paid/non-refunded matched revenue, and lead-to-buyer conversion. Meta-reported purchases should remain a diagnostic line only.

## Data sources and safeguards

The Kajabi result is based on the first-party lead ledger joined to recorded Kajabi purchases, with a separate direct transaction read used to confirm exact current Interconnected offer totals. The challenger result is based on the same lead ledger joined by normalized email and chronology to paid, non-cancelled Shopify Interconnected orders. The source records are aggregated in this report; no customer, email, order, or lead identifiers are shown.

## References

[1]: https://content.theurbanmonk.com/hub/analytics/reconciliation "Urban Monk Content Hub Sales Reconciliation"

[2]: https://try.theurbanmonk.com/interconnected-lp-3/ "Interconnected LP-3 Unbounce landing page"

[3]: https://content.theurbanmonk.com/interconnected/thank-you-klaviyo "Interconnected Klaviyo thank-you page"
