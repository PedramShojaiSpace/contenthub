# Unified Urban Monk Meta Purchase Architecture

## Recommendation

Move **all future Meta commerce signals** under the Urban Monk main Meta Pixel / conversion dataset (**ID `1498608757116877`**) while keeping **one Purchase emitter per checkout platform**.

> **Source of truth for financial reporting remains the paid-order ledger.** Meta Purchase reporting is an advertising optimization and diagnostic signal, not the revenue ledger.

The best architecture is not one sender across every platform. It is **one owned Urban Monk dataset with one authorized Purchase emitter for each payment system**:

| Checkout platform | Authorized Purchase emitter | Why |
| --- | --- | --- |
| Shopify | Shopify’s official Facebook & Instagram integration, connected to the Urban Monk Pixel, with its own web/server deduplication | Shopify owns its checkout and can reliably provide browser/server event matching. It should be the only Shopify Purchase sender. |
| Kajabi | Content Hub paid-Kajabi webhook → Urban Monk server-side CAPI | A paid order is the trigger; the Content Hub can record the order ID, event ID, value, and Meta delivery receipt. Kajabi’s native Pixel must not also emit Purchase to this dataset. |
| Content Hub pages | Urban Monk browser Pixel for PageView, Lead, CompleteRegistration, and InitiateCheckout only | Preserves funnel and ad engagement telemetry without creating a second Purchase event. |

## What the Shopify Inspection Changes

The Shopify Customer Events inventory shows:

| Current item | Data surface | Current condition | Required disposition |
| --- | --- | --- | --- |
| **Facebook & Instagram** | Server + Web | Optimized | Reconnect this official Shopify integration to the Urban Monk Meta business and Urban Monk Pixel. This becomes the sole Shopify Purchase emitter. |
| **MEGA - Sleep Kit Purchase** | Web only | Separate custom pixel | Inventory its script and retire it from Purchase emission after the Shopify Facebook & Instagram connection to the Urban Monk Pixel is verified. Do not leave it emitting Purchase beside the official integration. |

The Shopify app route confirms the account is connected to the **Urban Monk Facebook account / shop** and a Meta ad account. Its Customer Events list does not show the exact Pixel ID. Before a cutover, the Facebook & Instagram settings must be opened far enough to verify the target is the Urban Monk Pixel `1498608757116877`, not a Mega-owned dataset.

## Revised Cutover Plan

### Phase 0 — Record and protect current state

1. Capture screenshots of the current Shopify Facebook & Instagram data-sharing and Pixel connection, the MEGA custom-pixel script, Kajabi Facebook Pixel ID/access-token settings, and the current Meta Events Manager event quality.
2. Export the paid-order and current Meta reconciliation baseline for at least the prior 14 days. Do not compare post-cutover Meta purchase volume directly with the old Mega dataset; data ownership and learning history will be different.
3. Keep all campaign budgets, audiences, landing pages, and checkout routing unchanged during the pixel migration.

### Phase 1 — Shopify ownership cutover

1. In Shopify **Facebook & Instagram → Settings**, change the Meta business/data-set connection to the Urban Monk-owned business and Pixel `1498608757116877`.
2. Use Shopify’s optimized Server + Web data sharing; it is the platform-supported browser/server deduplication path.
3. Confirm a non-Purchase page event reaches the Urban Monk Events Manager from Shopify before changing any ads.
4. Inspect **MEGA - Sleep Kit Purchase**. If its custom code emits Meta `Purchase`, disable/delete that custom pixel only after the official Shopify app connection is confirmed. Do not retain both.
5. For Shopify campaigns, change ad-set conversion tracking to the Urban Monk dataset only after a real Shopify order is visible in both Shopify and the Urban Monk Events Manager.

### Phase 2 — Kajabi single-source Purchase cutover

1. Leave Content Hub CAPI as the only Kajabi Purchase path. It now records a redacted delivery receipt, event ID, value, and paid-order reference.
2. In Kajabi, remove only the native **Facebook Pixel ID / Access Token** integration after its current settings are safely recorded. This prevents Kajabi browser/server Purchase events from colliding with Content Hub CAPI Purchase events.
3. Keep Content Hub browser events for top-of-funnel funnel milestones. They must never call `Purchase`.
4. Validate three real Kajabi orders: each must produce one paid ledger order, one CAPI receipt, and one corresponding Urban Monk Meta Purchase action. Do not use fabricated revenue events.

### Phase 3 — Reporting and optimization governance

1. Keep the new Purchase Evidence comparison on the Reconciliation page: Meta-reported Purchases, accepted CAPI events, and first-party paid orders/revenue.
2. Separate Shopify and Kajabi in the ledger and reconciliation view. A unified Pixel does not justify pooled payment attribution.
3. Do not optimize Shopify or Kajabi ads for Purchase until the relevant platform has three verified real purchases on the Urban Monk dataset. Continue using the current approved lead or checkout optimization meanwhile.
4. Expect the Shopify transition to create a new conversion-history signal in the Urban Monk dataset. That is the unavoidable cost of ending Mega ownership; do not interpret the early post-cutover learning period as a performance failure.

## Rollback

| Risk signal | Rollback action |
| --- | --- |
| Shopify page or checkout events fail after connection change | Restore the recorded prior Shopify Facebook & Instagram connection; leave the MEGA custom pixel untouched until the cause is known. |
| Shopify official integration works but MEGA custom pixel still emits Purchase | Keep the Urban Monk official integration and disable only the MEGA custom purchase emitter. |
| Kajabi CAPI delivery receipt rejects a real purchase | Restore Kajabi’s prior native Pixel/Access Token only after the exact rejection is captured; do not leave both systems active. |
| Meta count and ledger remain materially divergent after three real purchases | Freeze optimization changes, inspect event IDs and source URLs in Events Manager, and retain the paid-order ledger as the authoritative revenue source. |

## Why This Is the Best Setup

It creates one dataset you own, prevents a departing agency from owning future Shopify conversion data, retains Shopify’s native checkout-strength event pipeline, and gives Kajabi a transaction-level CAPI audit that can be reconciled to paid orders. It also avoids a risky universal browser-pixel approach across platforms that do not share a durable event ID.

## Explicit Approval Required

The next real action changes the Shopify Facebook & Instagram Pixel/data-set assignment and ultimately removes Mega’s custom Purchase emitter. It will affect Shopify’s event ownership and may reset Shopify conversion learning on the Urban Monk dataset. No such action has been taken.
