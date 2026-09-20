# KO LP-3 ROAS Pressure Test — 20 September 2026

**Author:** Manus AI  
**Status:** Approved Purchase deduplication implementation validated locally; deployment verification pending

## Direct conclusion

**There is one real paid $67 Shopify order, not two.** Therefore, the correct current **booked ROAS** on Curt’s $117.22 spend snapshot is **0.57**, not 1.14. Meta’s 1.14 results from two $67 Purchase signals ($134 total) rather than two paid Shopify orders.

## Matched-window reconciliation

| Measure | Curt / Meta snapshot | First-party verification | Interpretation |
|---|---:|---:|---|
| Spend | $117.22 | Meta delivery metric | Meta remains the spend authority. |
| Leads | 40 | 32 KO/Klaviyo lead-ledger records | Meta counts conversion events; the first-party ledger counts accepted lead records. This eight-lead gap should be monitored separately. |
| Purchases | 2 | 1 paid, non-cancelled Shopify order | Shopify is the transaction authority. |
| Revenue | $134 Meta purchase value | $67.00 Shopify Interconnected line-item revenue | Meta’s value is exactly two $67 signals. |
| Buyer CPA | $58.61 Meta-reported | $117.22 Shopify-booked | One confirmed buyer. |
| ROAS | 1.14 Meta-reported | **0.57 booked** | $67.00 ÷ $117.22 = 0.5716. |

At 15:21 Central, a subsequent Meta API read had risen to **$126.49 spend**, **44 reported leads**, and still **two** purchases / **$134** reported value across the five `interconnected-lp-3` campaigns. Against the still-single $67 Shopify order, that later booked ROAS is **0.53**. It is a later snapshot, not a replacement for Curt’s reported $117.22 / 40-lead snapshot.

## Confirmed first-party financial result

The launch-window Shopify reconciliation (20 September, 16:00 UTC onward) found **32** KO/Klaviyo leads and **one** paid, non-cancelled Interconnected order matched by normalized buyer email and chronology. The matching Interconnected line-item revenue is **$67.00**. The corresponding lead-to-paid conversion rate is **3.13%**. No customer, lead, or order identifiers are included in this record.

The local Shopify-webhook ledger independently shows one unique qualifying Shopify order, one $67 order, and one Content Hub CAPI Purchase receipt. This supports the Shopify result but does not replace it as the financial authority. The repaired thank-you checkout bridge has recorded **one** post-repair checkout start at the time of this snapshot.

## Meta diagnostic snapshot

At the owner-reported snapshot, Meta showed **$117.22 spend**, **40 leads**, **two purchases**, **$58.61 cost per sale**, and **1.14 ROAS** for the `interconnected-lp-3` campaign group. A later live Marketing API read shows the same direction of discrepancy: the paid `interconnected-lp-3` campaign group reports two purchase actions and $134 of Meta purchase value in one campaign, while Shopify confirms one $67 paid order in the whole store for the Interconnected product during the launch window. The later read reflects an updated spend/lead total and must not overwrite the owner-reported snapshot.

Meta Events Manager confirms that the Urban Monk Pixel has both **Meta Pixel** and **Conversions API** integrations, and that Purchase is marked as a multiple-integration event. This establishes that more than one event source can reach the same pixel. It does not alone identify the event IDs or prove that a particular pair was or was not deduplicated.

The authenticated Shopify administrator navigation also shows the active **Facebook & Instagram** sales channel. That provides a credible browser-side Purchase source to investigate alongside the Content Hub server-side event, but the current Shopify settings view did not expose its event-ID payload or a per-order event history.

## Why Meta is showing two purchases

The financial discrepancy is confirmed: Shopify has one $67 paid order, whereas Meta reports two purchases worth $134 for the live LP-3 group. The evidence-supported diagnosis is **probable cross-source duplicate Purchase reporting**, not a duplicate Shopify order.

Shopify Customer Events lists the **Facebook & Instagram** pixel as both **Web** and **Server**. The Content Hub also sends one server-side Purchase for each newly received paid Shopify order. The qualifying $67 order has exactly **one** local CAPI Purchase receipt and exactly **one** CAPI event ID, so this is not a duplicate paid-order webhook or an application-level repeated CAPI call. However, the Content Hub’s Purchase event ID is deliberately generated as `purchase-{shopifyOrderId}-{timestamp}`. It cannot equal the event ID produced by Shopify’s browser/Meta-channel Purchase event. Meta documents that server and browser Purchase events require the same event name and event ID for deterministic deduplication [2].

The observed result—one $67 order, one Content Hub CAPI Purchase, Shopify Facebook & Instagram delivering Web and Server events, and Meta reporting two $67 purchase values—fits that mechanism precisely. Meta Events Manager corroborates that Purchase is a **multiple-integration** event for the Urban Monk Pixel. Event-level IDs are not exposed in the historical browser view, so the conclusion is intentionally labeled **probable**, rather than absolute. Meta attribution-window credit remains a secondary possible contributor, but it cannot create a second paid Shopify order and is less consistent with the exact $134 (= 2 × $67) value pattern.

The lead mismatch is separate from the purchase issue. The launch ledger contains 32 accepted KO/Klaviyo records, all Klaviyo-synced and CAPI-sent, while Meta’s later campaign read shows 44 Lead actions. The Lead implementation passes the same event ID from browser to Content Hub CAPI, so it is designed for deduplication. The gap could reflect browser-only submissions that did not persist to the ledger, repeated submissions, or reporting latency. It should be reconciled next, but it does not change the paid-order or booked-ROAS conclusion.

## Approved correction — implemented for all Shopify paid orders

The owner approved Shopify-native Purchase deduplication for all Shopify paid orders. The Content Hub now preserves every paid-order webhook, revenue record, checkout touch, cohort credit, Zipify order update, and Klaviyo post-purchase action, but it does **not** issue an additional Meta Purchase CAPI event. Shopify Facebook & Instagram is explicitly recorded as the single Meta Purchase authority.

The former manual “Retry CAPI” path is disabled server-side and removed from the attribution dashboard. New records display **Shopify native** as their Meta Purchase source. Historical records retain their legacy CAPI audit status for an honest history; they are not rewritten and no historical Meta events are deleted.

Local verification passed **29 focused tests** and a bounded-memory production build. No test order was created. The remaining step is a passive production observation of the next genuine Shopify paid order: it should create one first-party revenue record without a Content Hub CAPI Purchase dispatch, while Shopify’s native Facebook & Instagram integration continues to own Meta Purchase reporting.

## Calculation

Using Curt’s owner-reported **$117.22** spend and Shopify’s confirmed **$67.00** paid revenue:

\[
\text{Booked ROAS} = \frac{67.00}{117.22} = 0.5716 \approx \mathbf{0.57}
\]

This is the current booked ROAS. Meta’s 1.14 is its reported $134 purchase value divided by $117.22 spend; it is not supported by the single paid Shopify order.

## Current guardrails

No ad, budget, pixel ID, product, checkout, email, SMS, funnel, order, or payment setting was changed. The approved code change affects only future Content Hub Purchase CAPI dispatch for Shopify paid-order webhooks. The next task is a passive reconciliation of the next genuine Shopify order and a separate read-only investigation of the Meta Lead (40/44) versus first-party KO lead (32) gap.

## References

[1]: https://www.facebook.com/business/help/458681590974355 "Meta Business Help Center: About actions attributed to your ad"
[2]: https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events "Meta for Developers: Handling Duplicate Pixel and Conversions API Events"
