# Agora Kajabi Restart — Tracking Health Audit

**Scope:** Read-only assessment of current Meta delivery/spend, available purchase signals, Kajabi revenue reporting, and Meta/Shopify integration access after the Agora restart. No campaign, budget, ad, audience, pixel, connector, checkout, product, or order was changed.

## Current read-only evidence

| Source | Window / refresh state | Observed result | What it proves |
|---|---|---:|---|
| Meta Graph API collector | September 1–2, 2026 Central-day window, refreshed 2026-09-02T16:23:28Z | $424.44 spend; 243 leads; 18 checkouts; 10 Meta-reported purchases; $1,198.00 Meta purchase value; 2.8225x Meta ROAS | The server-side Meta reporting credential can currently read campaigns and insights. The numbers are live and can change during the active day. |
| Kajabi API collector | September 1–2, 2026 Central-day window, refreshed 2026-09-02T16:23:28Z | 6 successful/non-refunded transactions; $666.00 first-party revenue: four current $67 offers and two current $199 offers | The current Kajabi revenue reader is authenticated and returning transactions using exact Kajabi offer IDs. This is the revenue source of truth for the Kajabi funnel. |
| Content Hub Command Center | Owner-triggered read-only **Today** refresh | $238.93 Meta spend; 134 leads; 10 checkouts; $400.00 Kajabi revenue; four purchases; 1.67x first-party revenue ÷ Meta-spend view | The production Content Hub can execute its Meta snapshot and display current Kajabi revenue alongside it. |
| Shopify MCP | Minimal read-only active-product lookup | Successful response | The Shopify connector is operational for its available Admin API scope. It is not the revenue source for this Kajabi funnel. |

## Connector and source boundary

The built-in **Meta Ads Manager** connector is currently disabled in this task configuration. That does **not** prevent the current Content Hub’s reporting path from working: both the direct Graph API collector and the production Command Center read Meta spend successfully through the project’s server-side reporting credential. The Shopify connector is enabled and responded successfully to a read-only product lookup.

The direct Meta/Kajabi collector and Command Center should not be assumed to have identical filters or refresh timing. The two-day collector selects campaign names containing both `agora` and `interconnected`; the Command Center labels its displayed view as **Today** and reports an Agora-named-ad-set scope. Its observed today spend of $238.93 matched the direct collector’s September 2 Meta-spend snapshot, while its 134 lead count and $400.00 / four-purchase Kajabi total represent a narrower point-in-time dashboard view. The differing aggregate values are therefore a **scope/timing reconciliation item**, not evidence that either connection is offline. Meta-reported purchase value and Kajabi cleared revenue are separate measurement systems and must never be added together.

## Current conclusion

The technical ability to read restarted Agora spend, Meta lead/checkout signals, and Kajabi revenue is working. The dashboard refresh demonstrated a current tracked funnel state rather than a dead connector. The next analytical step is to make the dashboard’s exact today-window and ad-set/campaign selection transparent beside its totals, so it can be reconciled directly with repeatable Meta Graph reports. No scale recommendation is appropriate from the first partial restart window alone.

## Owner-confirmed current-day reconciliation — September 2, 2026

The owner’s Kajabi custom-date view showed exactly four paid current-day transactions: three active Interconnected $67 Bundle OTO purchases and one active $199 Gut Permeability and Food Sensitivity Testing w/ Coach purchase. No customer email addresses were retained in this audit.

An explicit **September 2 only** Central-time read at `2026-09-02T17:52:36Z` returned the same four exact-offer Kajabi transactions and **$400.00** in first-party revenue. It did not include September 1. At the same read, Meta returned $258.83 spend, 158 leads, and 12 checkouts for the selected Agora/Interconnected campaign-name scope. The correctly scoped first-party current-day revenue-to-spend ratio was therefore **1.5454x** ($400.00 ÷ $258.83).

| Current-day reconciliation item | Confirmed result |
|---|---:|
| Kajabi paid current-day transactions | 4 |
| Current $67 Interconnected Bundle OTO | 3 / $201.00 |
| Current $199 OCUS | 1 / $199.00 |
| Current Kajabi revenue | $400.00 |
| Meta spend (direct current-day read) | $258.83 |
| Current-day first-party revenue ÷ Meta spend | 1.5454x |

The earlier two-day figure of six transactions / $666.00 combined September 1 and September 2 by design. It was not a claim that six transactions occurred today. It is now superseded for any **today** reporting by the one-day Central-time reconciliation above.

### Corrective control

The Command Center and its exact-offer Kajabi reader now convert timestamps to the operational `America/Chicago` date before applying `Today`, `Yesterday`, and range boundaries. A focused regression test proves that a September 1 late-evening Central transaction represented after UTC midnight is excluded from the September 2 report, while a late September 2 Central transaction is included. The production build completed successfully.

## Fresh same-day operating read — 2026-09-03T00:02:57Z

The current **September 2 only** Central-time read confirms that ad delivery and first-party transaction tracking are both working. Twelve currently active Agora/Interconnected campaigns are included in the broader historical campaign-name set; the other 46 matched campaigns are paused and contribute no current delivery.

| Current same-day signal | Value |
|---|---:|
| Meta spend | $325.24 |
| Impressions / link clicks | 6,264 / 417 |
| Link click-through rate | 6.65% |
| Meta leads / cost per lead | 204 / $1.59 |
| Meta checkout events | 16 |
| Exact-offer cleared Kajabi orders / revenue | 4 / $400.00 |
| First-party revenue ÷ Meta spend | 1.2299x |
| Meta-reported purchase events / value | 10 / $934.00 |
| Meta-reported ROAS | 2.8717x |

The lead, checkout, Meta spend, and cleared Kajabi-order signals all updated in the current-day window, so there is no evidence of a delivery or transaction-ingestion outage. The **$400.00 / 4-order** Kajabi result is the operating first-party revenue figure for the funnel. Meta’s $934.00 reported purchase value is not additive and remains a material attribution difference from Kajabi; it should be monitored as a reporting reconciliation item rather than used alone as revenue.

## Sources

1. Read-only execution of `scripts/report-agora-restart-health-2026-09-02.mjs` at 2026-09-02T16:23:28Z, 2026-09-02T17:52:36Z, and 2026-09-03T00:02:57Z, using the current Interconnected $67 and $199 Kajabi offer IDs rather than price matching alone.
2. Production Content Hub: `https://content.theurbanmonk.com/hub/analytics/interconnected-command`, owner-triggered read-only refresh on September 2, 2026.
3. Read-only Shopify Admin MCP product lookup on September 2, 2026.
