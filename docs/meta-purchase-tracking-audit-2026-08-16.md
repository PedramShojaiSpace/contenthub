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

## Implementation Verification Note

The development reconciliation route was opened after the observability implementation began, but the preview rendered only its loading shell and no authenticated data contract. No additional Meta refresh was triggered. Focused server and parser tests remain the verification source until the repaired route is deployed to the authenticated production bundle.

### Post-checkpoint production check

The authenticated production reconciliation page was then opened for the same 2026-08-16 Interconnected range. It loaded the pre-existing four KPI cards and the correct first-party transaction log (11 × $67 and 1 × $199; $936.00 total), but it did **not** display the newly implemented fifth **Purchase Evidence** card. No manual Meta refresh was clicked. This establishes that the live page was still serving a pre-repair client bundle at that check, so a fresh production bundle publication and one explicit manual refresh remain required before presenting Meta Purchase count/value as verified live evidence.

The Hub Analytics bundle was rebuilt independently with a bounded 900 MB heap after temporarily stopping the development watcher. The resulting `Reconciliation-By3vgI5V.js` bundle contains the literal `Purchase Evidence` UI marker, and the development server was restarted successfully. This confirms the code compiles into the analytics artifact; only production asset freshness remains to be verified.

A second production-browser check after the subsequent publication checkpoint again rendered the older four-card reconciliation view without the `Purchase Evidence` label. The fresh local analytics artifact is therefore not yet the public browser artifact. The approved one-call Meta refresh remains intentionally unexecuted until the public UI and its persisted snapshot contract are demonstrably current.

The route was also re-opened with the publication checkpoint as a cache-busting query string (`?v=f06eeb75`), with the same older four-card result. This rules out a simple browser route-cache explanation and reinforces that the public analytics artifact itself remains stale.

Direct public-asset inspection captured the stale deployment evidence: production currently serves Hub Analytics entry `index-C4c9eWoD.js`, which imports `Reconciliation-PBYyOGqz.js`; that deployed Reconciliation chunk does **not** contain the `Purchase Evidence` marker. The bounded local rebuild produced `Reconciliation-By3vgI5V.js`, which does contain that marker. This is a specific production artifact publication discrepancy, not a browser cache issue or a local compilation failure.

## First Live Purchase Evidence Read

After the fresh production bundle became visible, one user-approved manual Meta refresh completed successfully and persisted a single snapshot. The resulting same-day evidence is:

| Source | Purchase count | Purchase value | Interpretation |
| --- | ---: | ---: | --- |
| Meta-reported | 24 | $1,137.00 | Current account-insights action/action-value result for the scoped Agora campaign set. |
| CAPI accepted receipts | 0 | $0.00 | Expected for historical orders because durable receipt logging began with this repair; it is not evidence that prior CAPI requests failed. |
| First-party paid Kajabi orders | 13 | $1,003.00 | 12 × $67 entry orders plus 1 × $199 OCU, directly visible in the reconciliation transaction log. |

Meta therefore exceeds the first-party paid-order count by 11 Purchase actions and exceeds first-party paid revenue by $134.00. The mismatch is real. The count and value deltas do not move in lockstep, which means this snapshot alone cannot identify a single duplicate order pattern. The next diagnostic step is to audit every browser-pixel and server-side Purchase emission path for the Interconnected/Kajabi journey, then collect CAPI delivery receipts prospectively from the next real Kajabi purchase. No campaign optimization, pixel selection, checkout, or event firing behavior has been changed as part of this read.

### Emission-path inventory

The Content Hub’s public Interconnected offer page emits only `PageView` and `InitiateCheckout`; a source-wide search found no browser `fbq('track', 'Purchase')` call in the Content Hub client or server templates. The Content Hub’s only confirmed Interconnected Purchase emitter is the Kajabi purchase webhook’s server-side CAPI call, which sends the resolved paid amount and one deterministic event ID per Kajabi order.

The current $67 offer checkout itself is served by the external Kajabi Academy domain and was accessible for visual inspection without submitting a purchase. Its Meta Pixel or Kajabi native conversion configuration cannot be established from the Content Hub source. That is now the principal external configuration question: an independently configured Kajabi browser Purchase event could coexist with the Content Hub CAPI event and would not deduplicate unless both paths share the same event ID. The current data does not prove that this is occurring, so no event path has been disabled.

### Kajabi admin navigation evidence

The owner-provided Urban Monk Academy Kajabi dashboard is accessible in the connected browser. Its site settings page exposes separate **Checkout**, **Integrations & Webhooks**, and account-level **Account tracking** configuration areas. The dashboard itself does not surface the configured pixel or conversion event settings, so the inspection must continue through these read-only configuration pages; no setting has been opened for editing or changed.

The site-level **Integrations & Webhooks** page confirms that Kajabi exposes a native Facebook Pixel integration with an enable toggle, Pixel ID field, and Access Token field. This establishes a capable Kajabi-native browser/event and server-access-token boundary separate from the Content Hub. The current values and enabled state have not yet been inspected or changed.

The connected browser’s page-level scroll is controlled by Kajabi’s internal layout, so the visible Facebook Pixel fields remain below the current viewport even though the page is loaded. The inspection is continuing through visible, read-only navigation only; no toggles, Pixel ID, Access Token, or Save control has been touched.

The native Kajabi Facebook Pixel integration is visibly enabled in the connected browser and its configured Pixel ID is **1498608757116877**—the same Urban Monk pixel used by the Content Hub CAPI sender. Kajabi also presents an Access Token field, but its value is not read or exposed in this audit. The shared pixel confirms that a Kajabi-native browser Purchase path can contribute to the same Meta reporting pool as the Content Hub server-side CAPI Purchase. The current UI does not expose a shared event ID or browser/server deduplication setting, so deduplication cannot be confirmed from this screen alone.

## Read-Only Audit Conclusion

The available evidence supports a **credible duplicate-Purchase risk**, not a conclusive duplicate-Purchase finding. Kajabi’s enabled native Facebook Pixel integration and the Content Hub’s paid-webhook CAPI sender point to the same Urban Monk Pixel ID, while the native integration UI does not offer a visible control for sharing the Content Hub’s deterministic CAPI event ID. Meta’s scoped snapshot also exceeds the first-party paid-order count and value for the same funnel window. However, this audit did not inspect an actual paid thank-you event trace or Meta Events Manager deduplication diagnostics, so it cannot prove which path emitted each excess action.

The operating recommendation remains unchanged: keep the current measurement architecture stable for now, use direct Kajabi transactions as the revenue source of truth, and rely on the explicit one-call manual Meta snapshot only for current Meta spend/actions. Do not disable Kajabi-native tracking or change pixel assignment until the approved Shopify pixel migration Phase 1 has been validated and the owner gives a separate explicit approval for any Kajabi native-pixel change. The next genuine Kajabi purchase should be reconciled prospectively through the new CAPI receipt audit before any event-emission change is proposed.
