# Interconnected ROAS Reconciliation — 2026-08-13

## Measurement basis

The reporting window is 2026-08-13 00:00–24:00 America/Chicago. ROAS uses verified gross Interconnected revenue divided by the approved Agora-only Meta spend, excluding VIBE, DSS, Tantra, and all other campaign families.

## Revenue result

The Content Hub database contains 13 Interconnected Kajabi purchases in this window for $87,100 cents ($871.00) gross. Ten records are currently matched to a Manus/Meta lead for $67,000 cents ($670.00). No Interconnected Shopify attributed-sales or lead-cohort-credit records were present in the same day window.

## Meta-spend status

The connected Meta Ads Manager session is authenticated, but its visible date control follows Pacific Time and reverted to the account’s default 30-day table after direct custom-range requests. The loaded campaign table did not expose an `Agora` row in its current viewport or page text. An exact Agora-only spend total has not yet been recovered; no ROAS should be stated until it is obtained from the first-party Meta source.

The local split development server returned the public bundle’s Not Found view for both the legacy Interconnected command-center route and the analytics Hub route. It therefore cannot currently be used as a browser surface for the internal live-spend query while the platform publication remains stalled.

## Final same-day inputs and ROAS

The authenticated Content Hub `kajabiSales.getMetaSpend` query returned the exact 2026-08-13 Agora-filtered Meta result: **$655.02 spend**, **986 leads**, and **68 checkout actions**. The companion `kajabiSales.getFunnelPurchases` query returned **13 confirmed Interconnected $67 purchases** totaling **$871.00**.

| Metric | Value |
|---|---:|
| Funnel ROAS (confirmed Interconnected revenue ÷ Agora spend) | **1.329730x** / **1.33x** |
| Strict matched-lead ROAS ($670 matched revenue ÷ Agora spend) | **1.022869x** / **1.02x** |
| Confirmed $67 purchases | 13 |
| Gross Interconnected revenue | $871.00 |
| Agora-only Meta spend | $655.02 |

The command center’s own ROAS definition uses the funnel-sourced purchase total, so the dashboard-equivalent answer is **1.33x**. The stricter 1.02x companion figure is provided only to distinguish the ten purchases currently matched by email to a tracked lead from the three confirmed funnel purchases awaiting a direct lead match.
