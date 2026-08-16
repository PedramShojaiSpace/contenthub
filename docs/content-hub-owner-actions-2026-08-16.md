# Content Hub: Owner and Platform Actions

**Prepared:** August 16, 2026  
**Purpose:** Close the few operational checks that cannot be completed safely through a source-code audit alone.

> The application code-level audit is clean: the public commerce contract is restored and the current full regression suite passes **149 files / 1,524 tests**, with two intentional skips. The actions below concern production service behavior, attribution evidence, and platform permissions.

## Action Summary

| Priority | Owner | Action | Completion evidence |
|---|---|---|---|
| 1 | Operator with Hub access | Monitor future production deployments and re-run the deep-link checklist if a blank shell recurs. | Representative Core, Content, Growth, and Analytics routes loaded correctly after the current deployment. |
| 2 | Shopify administrator | Validate the paid-order webhook with a controlled recent paid order. | The same order is visible in Shopify Admin, the Content Hub webhook recorder, and the correct isolated attribution view. |
| 3 | Curt / Meta app administrator | Apply for Meta `ads_management` production access. | Meta approves production access; the permission no longer reads “Ready for testing.” |
| 4 | Content Hub operator | Verify the first daily KO/Klaviyo Email → Revenue collector run after 15:15 UTC. | A managed-job success record and saved completed-day snapshot exist; Kajabi data remains absent from this collector. |

## 1. Production Deployment and Deep-Link Verification — **Current smoke suite passed**

The platform reported a successful deployment after earlier evidence of stale public bundle assets. An authenticated production-browser smoke suite subsequently confirmed the legacy YouTube-to-Blog redirect, Email → Revenue, Creation Studio, Reconciliation, YouTube Analytics, and Video Production routes. The checklist below is now a recurrence-monitoring procedure for future multi-bundle releases rather than a blocker on the current deployment.

| Check | Expected result |
|---|---|
| `https://content.theurbanmonk.com/hub/youtube-to-blog` | Redirects to the canonical Content YouTube → Blog tool. |
| `https://content.theurbanmonk.com/hub/content/video-to-blog` | Renders the YouTube → Blog Pipeline. |
| `https://content.theurbanmonk.com/hub/core/studio` | Renders Creation Studio. |
| `https://content.theurbanmonk.com/hub/growth/yt-analytics` | Renders YouTube metrics. |
| `https://content.theurbanmonk.com/hub/analytics/reconciliation` | Renders the saved-data reconciliation page and only calls Meta if **Refresh Meta (1 call)** is selected. |
| `https://content.theurbanmonk.com/hub/analytics/interconnected-email-revenue` | Renders the separate Kajabi and KO/Klaviyo reporting columns. |
| `https://content.theurbanmonk.com/hub/content/video-production` | Renders or redirects to the owning production tool. |

If one of these opens as a blank shell, capture the complete URL, approximate time, and a screenshot. That is the evidence needed to re-escalate the deployment synchronization issue; do not change paid-funnel behavior as a workaround.

## 2. Shopify Paid-Order Webhook Validation

The Shopify storefront and authenticated order reader are functioning, but the attribution-specific paid-order webhook last had first-party evidence 41 days before the audit. This is an evidence gap rather than proof that the store is offline. The current `ORDERS_PAID` subscription and the Content Hub’s raw-payload HMAC handling have now been verified and repaired; a real paid event is still required to close the evidence gap without introducing a false Purchase event.

First, in **Shopify Admin**, open **Settings → Notifications → Webhooks** and locate the Content Hub paid-order subscription. Confirm that the endpoint is the current production endpoint, the event is the paid-order event expected by the Hub, and recent delivery responses are successful.

Second, create or identify one recent real paid order. Record the Shopify order number and paid timestamp. In the Content Hub, verify that its webhook recorder has ingested the same order and that the order appears only in its proper revenue/attribution path. Do not pool Kajabi and KO/Klaviyo revenue when making this check. Do not create a fake order merely to populate reporting or Meta Purchase data.

| Result | Next action |
|---|---|
| Shopify record, Hub webhook record, and isolated attribution record all exist | Mark webhook evidence current; the attribution signal can be used as one input to reporting. |
| Shopify record exists but no Hub webhook record | Capture order ID, event timestamp, endpoint configuration, and Shopify delivery response; investigate endpoint auth, event type, and response handling. |
| Hub record exists but attribution is missing or cross-path | Preserve the order evidence and investigate the attribution mapping without changing checkout URLs or pooling Kajabi with KO/Klaviyo. |

## 3. Meta Production Access

The Meta app has creative/catalog infrastructure but the `ads_management` permission remains **Ready for testing**. Curt, or another administrator of Meta app **2150724875769823**, must complete the production-access application in Meta for Developers.

The application should document the existing business need accurately: the Content Hub prepares and manages Urban Monk creative workflows, while campaigns remain subject to account-level review and controls. Supply Meta with the requested app URL, privacy-policy and data-deletion URLs if prompted, and an app-review demonstration using the actual intended workflow. Do not use test-only access as a basis for production scale decisions.

Completion is Meta’s approval of the permission for production—not merely a submitted request. Until then, preserve the existing paused/draft behavior and use the Content Hub review flow rather than assuming ads can be pushed live programmatically.

## 4. Daily KO/Klaviyo Email → Revenue Collector

The isolated KO/Klaviyo collector is registered for **15:15 UTC** each day as `interconnected-email-performance-daily` with task UID `PN4tSqosxNU94dEpREqYAN`. A live schedule-inventory check confirmed that it is enabled; its execution log contained zero runs at the time of this audit, which is expected because the first scheduled window had not yet occurred. Its first managed run must be checked before operators treat it as an automatic reporting control.

After the scheduled time, open the Email → Revenue dashboard and inspect the current collector status. Confirm a successful managed-job result, a saved snapshot timestamp, and a nonzero/expected row count for the completed reporting day. Ensure that the stored path identifiers and displayed data remain entirely in the KO/Klaviyo column; Kajabi should continue to use its distinct native-import workflow.

If the job does not run or produces no snapshot, preserve the execution time and visible error. Do not trigger repeated Meta refreshes while troubleshooting, because the reconciliation page is intentionally designed to make only an explicit single Meta API call per manual refresh.

## Operating Guardrails

| Guardrail | Requirement |
|---|---|
| Attribution | Keep Kajabi and KO/Klaviyo reporting in separate, non-overlapping buckets. |
| Meta refresh | Use **Refresh view** for saved data; use **Refresh Meta (1 call)** only when a fresh Meta pull is intentionally needed. |
| Commerce | Do not alter storefront navigation, checkout URLs, or payment behavior as part of these validations. |
| Meta Pixel | Keep Shopify’s primary Meta pixel unchanged. |
| Funnel activation | Do not activate Klaviyo draft flows or Interconnected follow-ups as part of this checklist. |
