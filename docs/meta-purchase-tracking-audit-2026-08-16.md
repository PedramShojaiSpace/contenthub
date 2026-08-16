# Interconnected Meta Purchase Tracking Audit

## Scope and Reference Time

This audit covers the Interconnected Free Screening (Agora) funnel on **2026-08-16, America/Chicago**. It compares paid Kajabi transactions captured by the Content Hub with the one user-requested current Meta account-insights refresh. It does not change the pixel, CAPI sender, checkout, campaign optimization, or ad delivery.

## Verified Evidence

| Metric | First-party paid-order evidence | Current Meta reconciliation snapshot | Interpretation |
| --- | ---: | ---: | --- |
| $67 Interconnected Bundle orders | 11 today | Not represented as a Meta Purchase metric | Paid Kajabi transactions are recorded but the snapshot model does not retain a Meta Purchase count/value. |
| $199 OCUS order | 1 today | Not represented as a Meta Purchase metric | The record is lead-matched and appears in the transaction log at 03:09 CT. |
| Recorded Kajabi revenue | $936.00 across 12 sales today | $936.00 shown as first-party revenue | The reconciliation view correctly presents paid-order revenue. |
| Meta spend | N/A | $473.26 | The one-call Meta refresh returned spend and lead metrics. |
| Meta leads | N/A | 238 | The one-call Meta refresh returned leads. |
| Meta Purchase conversions | N/A | **Not queried or displayed** | This is the reporting defect that prevents a true first-party-versus-Meta Purchase comparison. |

## Root-Cause Findings

The reconciliation refresh asks Meta for `campaign_name`, `adset_name`, `spend`, and `actions`, but its result contract stores only **spend, leads, checkouts, and campaign lead summaries**. It calls the canonical lead and checkout parsers and never parses or persists `Purchase` actions or purchase value. Accordingly, the dashboard cannot verify whether Meta reports 0, 1, 12, or any other number of Purchase conversions for the same period—even after a successful manual Meta refresh.

The Kajabi purchase handler does attempt a server-side Purchase event after saving each qualified purchase. It sends the Content Hub pixel a hashed-email CAPI `Purchase` payload with value, currency, content name, order ID, and the Interconnected Kajabi checkout source URL. However, its `sendCapiEvent` helper returns only a boolean and does not persist Meta’s event receipt, response body, rejection reason, or event ID to an audit table. This means historical delivery health cannot be proven from current database rows alone.

> The evidence establishes a **measurement and observability gap**. It does not yet establish that Meta is rejecting Purchase events, double-counting them, or receiving the wrong value. Those questions require an approved reporting and delivery-audit improvement.

## Recommended Remediation — Approval Required

1. Extend the existing single-call manual Meta snapshot to parse and store `Purchase` count and purchase value from the action/action-value arrays. Preserve the current one-call policy and do not trigger Meta reads on page load.
2. Add a durable CAPI delivery-audit record for each Kajabi Purchase attempt: order ID, funnel, event ID, value, a hashed or redacted buyer reference, Meta HTTP status, accepted/rejected response, and timestamp. Do not store raw email or access tokens in the audit record.
3. Display three values side by side in Reconciliation: **Meta-reported Purchases**, **CAPI accepted Purchase events**, and **first-party paid orders/revenue**. Keep Kajabi, Shopify, and KO/Klaviyo buckets visibly separated.
4. Run one explicit on-demand verification after deployment and compare a short shared date range. If CAPI accepted events and Meta Purchase counts still diverge, inspect the Kajabi webhook signature/raw-body treatment and Meta Events Manager diagnostics before changing campaign optimization.

No changes should be made to campaign delivery or optimization until that evidence exists.
