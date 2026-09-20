# Zipify $199 Post-Purchase Revenue Attribution Upgrade

**Status:** Implementation complete; Shopify webhook subscription pending deployment verification and configuration.  
**Date:** September 20, 2026  
**Scope:** $67 Interconnected purchase → Zipify post-purchase $199 Gut Permeability Test + 1-Hour Health Coach Call offer.

## Why this is needed

Zipify adds an accepted one-click offer to the buyer’s **existing paid Shopify order** rather than creating a separate $199 order. A paid-order webhook received before the buyer accepts the offer therefore records the original $67 total. Shopify’s documented **Order update** event is the appropriate follow-on signal for amendments to an order.[^shopify-webhooks] Independent post-purchase tracking guidance likewise identifies the `orders/updated` webhook as the normal update signal when a post-purchase app adds products to an existing order.[^littledata]

Without an update handler, the Shopify storefront can collect the $199 correctly while the Content Hub’s first-party attribution record remains at $67. That would understate the Shopify arm in the Kajabi-versus-Shopify comparison.

## Implemented behavior

The Content Hub now exposes this protected raw-body endpoint:

```text
https://content.theurbanmonk.com/api/shopify/order-updated
```

When Shopify delivers a valid, HMAC-signed **Order update** payload for an already-attributed paid order, the receiver:

1. Rejects unsigned, malformed, missing-ID, and non-paid payloads.
2. Looks up the original attributed Shopify order; unrelated orders are ignored rather than modeled.
3. Updates the existing order’s total and line-item snapshot **only when the total increases**.
4. Raises the corresponding single lead-cohort purchase credit to the final amended order value, preventing one buyer from being counted twice.
5. Does **not** send a second Meta Purchase event or create a second purchase record.
6. Leaves refunds and downward adjustments out of this path for separate reconciliation rather than silently netting them against an upsell.

Focused regression tests cover the $67 → $266 scenario, prevention of negative incremental credit, signed-route placement before JSON parsing, and existing cohort attribution behavior. The focused suite passed **12/12**; the bounded-memory production build completed successfully.

## Remaining Shopify configuration

After the deployed route is publicly verified, add exactly one Shopify webhook:

| Shopify field | Required value |
|---|---|
| **Event** | **Order update** |
| **Format** | **JSON** |
| **URL** | `https://content.theurbanmonk.com/api/shopify/order-updated` |
| **Webhook API version** | Current stable version shown by Shopify |

> Do **not** remove the existing **Order payment** webhook. The two events have different jobs: Order payment records the original paid order; Order update raises the existing tracked revenue if Zipify adds the accepted $199 one-click offer.

Shopify documents the navigation as **Settings → Notifications → Webhooks → Create webhook**, then selecting the event, JSON format, URL, API version, and Save. Shopify also provides **Send test** from the webhook row for a non-purchase verification.[^shopify-webhooks]

## First genuine-order reconciliation

No test order was created. On the first genuine $67 Interconnected purchase that is eligible for the Zipify offer, verify these five points in order:

1. The Zipify post-purchase screen was eligible to render for the buyer.
2. A decline leaves the original order at $67; an acceptance increases the **same Shopify order** by $199.
3. The Order update webhook returns a successful delivery in Shopify.
4. The Content Hub’s paid-order ledger retains **one buyer / one order** at the final order value, not two buyers.
5. The KO/Klaviyo and Shopify reconciliation view reports the $67 entry sale and $199 accepted upgrade separately in the tier detail, while total revenue reflects the final Shopify order state.

[^shopify-webhooks]: Shopify Help Center, [Creating webhooks](https://help.shopify.com/en/manual/fulfillment/setup/notifications/webhooks), accessed September 20, 2026.
[^littledata]: Littledata, [Tracking post-purchase upsells on Shopify](https://help.littledata.io/sources/shopify/tracking-post-purchase-upsells-in-the-shopify-checkout), retrieved September 20, 2026.
