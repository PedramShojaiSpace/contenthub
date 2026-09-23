# Klaviyo Thank-You Page → Kajabi $67 Checkout Swap

**Date:** 23 September 2026  
**Status:** Implemented in source; pending production deployment verification  
**Scope:** Klaviyo LP-3 thank-you page only

## What changed

The Klaviyo-specific Interconnected thank-you page (`/interconnected/thank-you-klaviyo`) now sends its $67 calls to action to the published Kajabi checkout:

> `https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout`

A direct browser inspection confirmed that this is the published **Interconnected: The Complete Healing Protocol** offer at **$67.00 USD**. The visual CTA language has been updated from “Secure Shopify checkout” to “Secure Kajabi checkout.”

The prior Shopify cart/product handoff is no longer used by this thank-you page. The legacy Shopify cart and its $199 Zipify path were not changed elsewhere.

## What remains intact

The CTA still passes through the Content Hub first-party `/r/checkout` bridge before redirecting to Kajabi. The bridge records one checkout touch with the existing, isolated Klaviyo identifiers:

| Field | Value |
|---|---|
| UTM source | `klaviyo` |
| UTM medium | `email` or `sms` when explicitly supplied |
| UTM campaign | `interconnected_14day` |
| UTM content | `ty_b_klaviyo_v1_67_checkout` |
| Funnel path | `ko_klaviyo` |
| Message key | `ty_b_klaviyo_v1_67_checkout` |
| Checkout destination | Kajabi $67 offer checkout |

This preserves the Klaviyo closing-touch ledger and the original lead cohort. Because Kajabi does not accept Shopify cart attributes, this route intentionally does **not** create a Shopify click-token attribute. Kajabi’s signed purchase webhook remains the financial authority for the purchase; the Content Hub matches the buyer to the existing Interconnected lead cohort by the established first-party logic.

## Why this is the correct next configuration

The Kajabi checkout now provides the native post-purchase experience that contains the owner-configured digital Upstream OCU. Moving the Klaviyo thank-you page to the Kajabi $67 checkout makes the immediate paid offer and native OCU stack consistent with the Kajabi path while retaining Klaviyo lead nurture and post-purchase lifecycle control.

This change also means any funnel analysis must split at the **cutover timestamp**. Pre-cutover Klaviyo/Shopify results remain a Shopify/Zipify cohort; post-cutover Klaviyo results become a Klaviyo-acquisition → Kajabi-checkout cohort. They must not be blended as one destination arm.

## Verification performed

Focused regression tests pass **8/8**:

- Klaviyo thank-you checkout URL targets the published Kajabi $67 offer.
- The first-party bridge retains the Klaviyo UTM and isolated message identifiers.
- The allowed Kajabi destination retains UTMs and correctly omits Shopify-only cart attributes.
- The visual page contains Kajabi checkout language and no legacy “Secure Shopify checkout” copy.
- Existing separate legacy $199 post-purchase Shopify route behavior remains covered.

The bounded-memory production build completed successfully.

## Explicit non-changes

No Kajabi offer, price, payment provider, OCU setup, post-purchase order, email/SMS content, flow activation, traffic allocation, ad, or budget was changed. In particular, this work does **not** remove the still-published $199 testing upsell visible after the new $99 Upstream OCU. If that older testing OCU should be removed from the Kajabi purchase flow, it requires a separate explicit configuration decision.

## Final production check

After the deployment reaches the custom domain, verify only the public page and redirect chain:

1. Load `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo` with a harmless UTM query.
2. Click one $67 CTA without entering checkout information or submitting payment.
3. Confirm the browser arrives at `theacademy.theurbanmonk.com/offers/57E3XFtT/checkout` and shows **Interconnected: The Complete Healing Protocol — $67.00**.
4. Confirm the first-party checkout-touch ledger shows the existing Klaviyo path/message key with the Kajabi destination.

No purchase or test order is needed for this verification.

---

**Relevant source files:**

- `client/src/lib/interconnectedKlaviyoCheckout.ts`
- `client/src/pages/InterconnectedThankYouKlaviyo.tsx`
- `server/emailCheckoutTracking.ts`
- `server/interconnectedKlaviyoCheckout.test.ts`
- `server/emailCheckoutTracking.test.ts`
- `server/interconnectedKlaviyoExitIntent.test.ts`

**Related tracking plan:** `docs/interconnected-kajabi-checkout-klaviyo-lifecycle-scope-2026-09-22.md`

**Implementation state:** Source change and tests are complete; production redirect verification is the remaining release validation.
