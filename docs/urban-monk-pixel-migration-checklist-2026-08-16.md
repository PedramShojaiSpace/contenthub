# Urban Monk Pixel Migration Checklist

**Status:** Planning only. **No pixel, checkout, campaign, conversion-location, or optimization setting has been changed.**

## Objective

Transfer future Shopify Meta commerce tracking from the Mega MEGA-owned path to the **Urban Monk Pixel / conversion dataset (`1498608757116877`)**, while ensuring that each checkout platform has only one authorized Purchase emitter. Shopify will use Shopify’s official Facebook & Instagram integration; Kajabi will use the Content Hub paid-order webhook/CAPI path. The paid-order ledger remains the financial source of truth.

> Do not make this a single “flip every switch” operation. Shopify ownership, the MEGA custom pixel, Kajabi-native tracking, and ad-set conversion configuration must be changed and validated in sequence.

## Guardrails

| Rule | Required behavior |
| --- | --- |
| No silent checkout change | Do not edit Shopify checkout, Kajabi offer pages, products, payments, or order routing during the pixel migration. |
| One Purchase emitter per platform | Shopify’s official integration is the only Shopify Purchase path; Content Hub CAPI is the only Kajabi Purchase path. |
| No pooled revenue | Continue keeping Kajabi and Shopify paid-order evidence separate even after both use the Urban Monk Pixel. |
| No synthetic revenue | Use real purchases only for final validation. Do not create test orders or fake Purchase events. |
| No simultaneous optimization change | Do not change campaign budgets, audiences, creative, landing pages, or optimization events during the migration window. |
| Reversible cutover | Record every current connection before changing it; stop and roll back if validation fails. |

## Phase 0 — Preflight Evidence and Access

Complete every item below before touching a connection.

| Owner | Checklist item | Evidence to capture | Pass condition |
| --- | --- | --- | --- |
| Owner / Curt | Confirm Urban Monk Meta business has administrator access to Pixel `1498608757116877` and the active Shopify ad account. | Screenshot of Meta Business / Events Manager access. | Urban Monk controls the target dataset and account. |
| Owner / Curt | Open **Shopify → Facebook & Instagram → Settings**. | Screenshot showing the current business, ad account, data set/pixel, and data-sharing mode. | Current Mega-era connection is documented before change. |
| Owner / Curt | Open **Shopify → Settings → Customer events → MEGA - Sleep Kit Purchase**. | Screenshot or copy of the custom-pixel script and status. | We know whether it sends Meta `Purchase`, and which Pixel ID it targets. |
| Content Hub | Save the current 14-day paid-order ledger and Purchase Evidence dashboard screenshot. | Kajabi and Shopify order/revenue separately; current Meta purchase snapshot. | Baseline is preserved for comparison. |
| Owner / Curt | Open **Kajabi → Settings → Integrations**. | Screenshot of Facebook Pixel ID and Access Token state. | The native Kajabi path is documented for rollback. |
| Content Hub | Confirm the Purchase Evidence card and CAPI audit are deployed. | Reconciliation shows Meta / CAPI / paid-order columns. | Future real Kajabi sales can receive a receipt record. |

**Stop condition:** If the Facebook & Instagram Shopify settings do not show the Urban Monk Pixel as a selectable target, do not disconnect Mega. Resolve Meta business ownership/access first.

## Phase 1 — Shopify Ownership Cutover

**Scope:** Shopify only. Do not touch Kajabi in this phase.

1. In **Shopify → Facebook & Instagram → Settings**, select the **Urban Monk** Meta business and Pixel / conversion dataset `1498608757116877`.
2. Preserve Shopify’s **optimized Server + Web** data-sharing mode. That official integration becomes the sole authorized Shopify event path.
3. Save the change, then open the Urban Monk Events Manager. Confirm a non-Purchase Shopify page event arrives from `shop.theurbanmonk.com`.
4. Inspect the **MEGA - Sleep Kit Purchase** custom-pixel script captured in preflight.
   - If it emits Meta `Purchase` to a Mega-owned or second dataset, disable that custom pixel only after Step 3 is confirmed.
   - If it is unrelated to Meta Purchase, leave it untouched and document its purpose.
5. Do **not** change the conversion location on Shopify ad sets yet. Wait for a real Shopify paid order to appear in both Shopify and the Urban Monk Events Manager.

| Shopify validation | Pass condition | Failure / rollback |
| --- | --- | --- |
| Event ownership | Urban Monk Events Manager receives Shopify web/server activity. | Restore the saved Facebook & Instagram app connection. Leave MEGA custom pixel unchanged until root cause is known. |
| Duplicate prevention | Only one Shopify Purchase source is active after the MEGA script decision. | Restore the saved state if official integration fails; do not leave two Purchase sources active. |
| Real-order proof | A real Shopify paid order has one matching Urban Monk Purchase signal and one ledger entry. | Hold campaign conversion-setting changes and inspect event source/ID. |

## Phase 2 — Kajabi Single-Source Purchase Cutover

**Scope:** Kajabi only. Begin only after Shopify Phase 1 is healthy.

1. Confirm Content Hub has the paid Kajabi webhook/CAPI Purchase path enabled and the latest deployment includes durable redacted receipts.
2. Record the current Kajabi native Facebook Pixel ID and Access Token settings for rollback.
3. In Kajabi, remove only the native Facebook Pixel / Access Token integration. Do not alter the offer, checkout, checkout URL, email flow, or webhook.
4. Keep Content Hub browser tracking on its own pages for PageView, Lead, CompleteRegistration, and InitiateCheckout. It must not emit Purchase.
5. Validate the next **three real Kajabi paid orders**. For each, log:

| Required field | Expected result |
| --- | --- |
| Paid-order ledger order ID and value | One paid Kajabi order. |
| Content Hub CAPI event ID | One deterministic event ID tied to that paid order. |
| CAPI receipt | One accepted or clearly diagnosed receipt. |
| Urban Monk Events Manager | One Purchase effect for the same order window. |
| Reconciliation card | Meta, accepted CAPI, and paid-order figures remain explainable and separately labeled. |

**Stop condition:** If any CAPI receipt rejects a real Kajabi paid order, restore the recorded Kajabi native settings only after the rejection evidence is captured. Do not run both Purchase systems indefinitely.

## Phase 3 — Advertising and Reporting Governance

After each platform has at least three verified real purchases on the Urban Monk dataset:

1. Update only the relevant platform’s ad sets to use the Urban Monk Pixel / dataset for Purchase optimization.
2. Do not compare the new Urban Monk dataset’s early Purchase count against Mega’s historical conversion total as if they were a continuous series. The new owned dataset must build its own signal.
3. Keep paid-order revenue as the final revenue truth. Use Meta Purchase events for optimization and discrepancy monitoring only.
4. Review the Purchase Evidence card weekly during the first 30 days. Escalate if Meta Purchase count or value remains materially different from paid-order evidence after the three-order validation set.

## Final Confirmation Gate

No connection or event behavior should change until the owner sends this exact approval:

> **“Approve Phase 1 Shopify Urban Monk pixel cutover. Confirm the target Pixel is 1498608757116877, preserve Shopify Server + Web, and do not touch Kajabi yet.”**

After Phase 1 passes real-order validation, a separate confirmation is required for Kajabi:

> **“Approve Phase 2 Kajabi single-source Purchase cutover. Disable Kajabi’s native Pixel/Access Token only; retain Content Hub CAPI Purchase and browser funnel events.”**

## Reference Links

| Destination | URL |
| --- | --- |
| Shopify Customer Events | `https://admin.shopify.com/store/theurbanmonkstore/settings/customer_events` |
| Shopify Facebook & Instagram | `https://admin.shopify.com/store/theurbanmonkstore/apps/facebook-ads/shopify_app/home/` |
| Kajabi Integrations | `https://app.kajabi.com/admin/sites/2148432935/integrations/edit` |
| Content Hub Reconciliation | `https://content.theurbanmonk.com/hub/analytics/reconciliation` |
