# ROAS Check Working Notes — 2026-09-18

## Verified source observations

- Content Hub reconciliation page: `https://content.theurbanmonk.com/hub/analytics/reconciliation`.
- Reporting funnel selected: **Interconnected Free Screening (Agora)**.
- At 2026-09-18 approximately 18:04 Central, the page's current-day Kajabi read showed **$802.00 recorded revenue** across **10 transactions**: nine $67 entry purchases ($603.00) and one $199 OCU ($199.00). The page had no saved Meta snapshot for that day, so it showed zero Meta spend pending an explicit refresh.
- Reconciliation source code confirms current Agora revenue is filtered to the registered Kajabi offers and excludes Shopify for this funnel. Its display ROAS calculation is recorded eligible revenue divided by separately filtered Meta spend.
- Meta Ads Manager authenticated account opened as account `10207858653523297`. Its date picker says that dates are shown in Pacific Time. The requested rolling 72-hour period requires a three-day or custom range and must not be mixed with the current-day-only Kajabi tally without aligning dates.
- No ad settings, budgets, delivery status, or campaigns were changed. Browser work has been read-only.

## Next collection step

Read the three-day Meta amount-spent total only for Agora campaign/ad-set names, then collect the matching Kajabi dated total and calculate revenue / spend. Clearly state the source time-zone caveat.

## Aligned 72-hour-day-window result

At approximately 18:09 Central on 2026-09-18, an on-demand Meta snapshot was saved for the **Interconnected Free Screening (Agora)** funnel for **2026-09-15 through 2026-09-18**, using the Content Hub's Central-time day boundary. The snapshot returned **$1,323.46 Meta spend**, **880 Meta-reported leads**, and **$1.50 CPL**. The matching live Kajabi transaction scan returned **$2,004.00 in paid, non-refunded revenue from 24 transactions**: 21 $67 entry purchases ($1,407.00) and three $199 OCUs ($597.00). Shopify was inactive for this funnel and was not included.

The booked-revenue ROAS for this aligned date range is therefore **$2,004.00 / $1,323.46 = 1.5142x**, conventionally reported as **1.51x (151.42%)**. The available lead-matched lower-bound reading is **0.86x** because matching is incomplete in this early cohort; it should not be substituted for booked-revenue ROAS. The dashboard also reports Meta pixel purchase value separately as $6,095.40 across 55 pixel-attributed purchases. It is not used in this calculation because Kajabi-cleared revenue is the agreed source of truth.

The day-window spans four Central calendar dates rather than an exact timestamp-to-timestamp rolling 72 hours. The earliest listed date contained one $199 Kajabi purchase, so this report preserves it rather than silently discarding it. No campaigns, budgets, delivery settings, or ads were changed.
