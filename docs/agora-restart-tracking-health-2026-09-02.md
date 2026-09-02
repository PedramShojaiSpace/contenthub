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

## Sources

1. Read-only execution of `scripts/report-agora-restart-health-2026-09-02.mjs` at 2026-09-02T16:23:28Z, using the current Interconnected $67 and $199 Kajabi offer IDs rather than price matching alone.
2. Production Content Hub: `https://content.theurbanmonk.com/hub/analytics/interconnected-command`, owner-triggered read-only refresh on September 2, 2026.
3. Read-only Shopify Admin MCP product lookup on September 2, 2026.
