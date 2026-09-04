# Entity Card: Urban Monk Agora-to-Shopify Downstream Attribution

| Field | Defined scope |
|---|---|
| Common entity | The Urban Monk / Urban Monk Productions, Inc. |
| Operating systems | Shopify storefront, Kajabi funnel and transaction system, Meta Agora acquisition reporting, and Content Hub first-party lead records |
| Listing status | Private operating business; no public-market ticker or exchange |
| Reporting currency | USD; order values reported as Shopify paid-order values after exclusion of cancelled/voided/refunded orders where the source returns those states |
| Primary question | Determine whether recent higher-ticket Shopify orders can be matched to prior verified Agora funnel leads and quantify cohort-associated downstream revenue |
| Qualifying Shopify order values | $299, $399, $499, and the owner-indicated approximate $1,608 combination-price level; exact line-item totals will be inspected rather than inferred from price alone |
| Lead-cohort rule | A qualifying purchaser is matched only when a normalized email hash matches a first-party lead record whose source is explicitly Agora/Interconnected/Agora-related. No inferred source is treated as verified. |
| Time boundary | Recent orders will be anchored to the post-Agora-restart period beginning September 2, 2026 unless source data identifies a different explicit relevant window; exact timestamps will be reported in America/Chicago. |
| Attribution definition | Cohort association, not causal proof: a matched historical Agora lead who later completes a qualifying Shopify purchase. Attribution must retain the lead-to-order time lag and source limitations. |
| Privacy boundary | Customer emails, names, order IDs, addresses, and any raw identifiers remain out of reports, logs, and attachments. Matching runs locally using normalized hashes and returns aggregates only. |
| Exclusions | No changes to orders, customers, Shopify settings, Kajabi, Meta, campaigns, audiences, emails, pages, or attribution settings. No use of health/sensitive quiz responses in the matching logic. |

## Access diagnostic — 2026-09-04

The owner’s authenticated Shopify Admin browser verified that the selected store is **Urban Monk Productions / `theurbanmonkstore.myshopify.com`** and its Orders screen currently shows an order history with recent paid qualifying-price orders. This confirms the business data exists in the intended store. No customer names, emails, addresses, or order IDs are retained in this record.

The secure project Shopify Admin connection returns the same store identity and has `read_orders` plus `read_all_orders` in its reported app scopes, but its unfiltered `ordersCount` response is zero. This is therefore an **integration-side order-index/authorization data mismatch**, not evidence that the Shopify store has no orders. The planned attribution analysis must remain blocked until the connector returns the same data that the owner-visible Admin order index exposes, or until the owner explicitly approves a separate secure data-export route.
