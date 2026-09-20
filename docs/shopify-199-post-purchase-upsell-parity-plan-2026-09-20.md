# Shopify $199 Post-Purchase Upsell Parity Plan

**Prepared by:** Manus AI  
**Date:** September 20, 2026  
**Status:** Planning only. No Shopify app, checkout, product, price, Klaviyo flow, tracking, or paid-traffic setting has been changed.

## Conclusion

The concern is correct. Comparing Kajabi against Shopify before Shopify has a credible $199 post-purchase path would make the Shopify/Klaviyo arm structurally weaker. The Kajabi control’s observed early cohort produced two $199 upgrades from eleven cleared $67 purchases, or an 18.18% attach rate. That is a small sample, but it is still material incremental revenue and must be treated as part of the control experience rather than ignored.[1]

The Shopify challenger should therefore be treated as a **transport-validation cohort**, not a decision-ready revenue comparison, until its $199 upgrade path is live and tracked. The recommended solution is a **native Shopify post-purchase offer** that can add the $199 member offer after a successful card checkout without asking the buyer to enter payment information again. A short Klaviyo recovery sequence should cover buyers for whom Shopify does not surface a post-purchase offer.

## The Shopify Offer to Use

The published Shopify catalog contains a strong candidate for the matching offer. It is not necessary to create a new product or alter a price.

| Role | Shopify product | Product / variant | SKU | Customer-facing price | Current public evidence |
|---|---|---|---|---:|---|
| Base purchase | Interconnected: The Complete Healing Protocol | Product `9087631753370` / variant `48959577653402` | `UM-OTO` | $67 | Existing KO checkout product |
| Post-purchase upgrade candidate | Gut Permeability Test + Health Coach Call — $199 Member Offer | Product `9096395620506` / variant `48994340077722` | `FIT-22-OCUS-199` | $199, shown against $299 | Published, available, tagged `ocus` and `upsell` [2] |

The owner confirmed on September 20 that **`FIT-22-OCUS-199` is the intended Shopify $199 offer for this Interconnected upgrade path**. The public Shopify title says “Gut Permeability Test + Health Coach Call,” while the Kajabi benchmark was described as “Gut Permeability and Food Sensitivity Testing”; use the verified Shopify SKU and its stated package scope consistently in the Shopify arm.

## Recommended Architecture

### Primary path: native Shopify post-purchase offer

Use one Shopify-native post-purchase upsell app to show the $199 offer **after** the $67 payment succeeds but **before** the regular Shopify order-status page. The app must apply the accepted $199 product to the existing order and charge the stored card without a second checkout. This is the closest Shopify equivalent to Kajabi’s OCUS and is the only path that should be presented to the buyer as a verified one-click upgrade.

Shopify supports post-purchase product offers in this position. The buyer pays for the initial order first, then sees a dedicated post-purchase page that can modify the order when the stored payment method is eligible.[3] Only one post-purchase app can control that page, so the selected app must be the single owner of the experience.[3]

**Recommended app route:** install and configure a mature Shopify post-purchase upsell app that uses Shopify Checkout Extensibility, such as **Aftersell** or **Zipify OneClickUpsell**. Select **one**, not both. The selection should be based on whether it can meet the required rule, shows the offer after a $67 `UM-OTO` purchase, uses the $199 `FIT-22-OCUS-199` variant, supports a genuine one-click acceptance, and exposes adequate order-level reporting. This route is faster and less risky than building a custom extension.

### Fallback path: Klaviyo recovery, not a one-click claim

A native post-purchase offer will not appear for every payment method. Shopify does not surface the page for wallet and installment methods such as Shop Pay, Apple Pay, Google Pay, Klarna, Affirm, AfterPay, Amazon Pay, and certain other non-card or unsupported scenarios. It also has limitations for multi-currency, duties, local delivery, and orders without a shipping address.[3]

For those cases, Klaviyo should send a short **post-purchase recovery** sequence only after a verified Shopify $67 payment:

1. Send the normal $67 receipt/confirmation first.
2. Wait 15 minutes, then send the $199 offer only if the buyer does not have the $199 product attached to the order.
3. Send one checkout-abandonment reminder after 24 hours only to buyers who clicked the $199 link but did not buy.
4. Send one final close message within a genuine, stated offer window; suppress immediately at purchase.

This fallback requires a second checkout and must never be described as one-click. It keeps wallet buyers in the same offer economics without pretending that the payment experience is equivalent.

## Why a Custom Build Is Not the First Choice

| Approach | What it gives the buyer | Tradeoffs | Cost | Setup complexity |
|---|---|---|---:|---|
| **Recommended: one native Shopify upsell app** | Immediate post-payment $199 acceptance without re-entering card details when eligible | Requires selecting one app; some payment methods fall back to email | App subscription or trial | Moderate, fast |
| **Custom Shopify post-purchase extension** | Fully branded, custom one-click experience | Shopify’s custom post-purchase extensions are beta and need live-store access approval; requires a Shopify Partner app, app hosting, signing, testing, and ongoing maintenance | Engineering time | High, slower |
| **Klaviyo-only upgrade email** | Reaches all $67 buyers | Second checkout; lower-friction parity is not achieved; should be a fallback, not the sole upsell | Low | Low |

A custom extension is technically possible, but Shopify’s current documentation says that live-store use of a custom post-purchase extension requires access approval and the feature remains beta.[4] That is not the fastest way to make the challenger fair. The app-plus-email-fallback plan produces usable parity quickly while preserving a path to a custom build later if the economics prove it worthwhile.

## Exact Configuration Contract

The chosen Shopify upsell app should be configured exactly as follows.

| Setting | Required value |
|---|---|
| Eligibility trigger | Paid Online Store order containing `UM-OTO` / product `9087631753370` / variant `48959577653402` |
| Offer product | `FIT-22-OCUS-199` / product `9096395620506` / variant `48994340077722` |
| Offer price | $199.00; preserve the public $299 comparison only if it is the genuine regular price |
| Quantity | One |
| Exclusions | Any order already containing the $199 product; buyers with an existing confirmed $199 purchase in the selected suppression window; cancelled, refunded, test, or non-paid orders |
| Placement | Shopify post-purchase page before order status; the thank-you page remains an order confirmation, not an upsell replacement |
| Copy | “Complete the diagnostic picture” framing, clear inventory of what the test and health-coach call include, and a clear statement of what happens after acceptance |
| Claims | No diagnostic, treatment, cure, or guarantee claims beyond approved product language |
| Shipping/tax | Let Shopify calculate the actual changeset. Do not promise free shipping, total price, or delivery timing unless the live checkout preview confirms it. |
| Decline path | Continue directly to the normal Shopify order-status page without another offer |
| Offer count | One $199 offer only; do not add a second upsell, a downsell, or a discount while establishing the baseline |

The post-purchase app must be placed behind the normal paid $67 checkout, not a Klaviyo click, checkout-start event, or abandoned-cart signal. The correct denominator is **confirmed paid $67 buyers**.

## Tracking and Measurement Changes Required Before Launch

The existing KO ledger already tracks the $67 Shopify order path. It must be expanded to track the **incremental $199 attach** without double-counting the original $67 purchase.

### Order ingestion

The Content Hub must retain the original $67 order as the base purchase and add a separate $199 attach record when the order is modified after the post-purchase offer is accepted. Native Shopify post-purchase offers modify the original order after payment; the existing `orders/paid` listener alone is not sufficient to safely identify the added line item. Add a verified `orders/updated` webhook receiver and make its handling idempotent by Shopify order ID plus added line-item ID or SKU.

The required system outputs are:

| Metric | Definition |
|---|---|
| Eligible $67 buyer | Paid, non-refunded order containing `UM-OTO` |
| Native $199 attach | Same order later contains `FIT-22-OCUS-199` after a post-purchase modification |
| Email-fallback $199 attach | A separately paid `FIT-22-OCUS-199` order by the same buyer after the verified $67 order, within the declared attribution window |
| $199 attach rate | Unique buyers with a paid $199 attach ÷ unique eligible $67 buyers |
| Revenue per $67 buyer | ($67 base revenue + incremental $199 revenue) ÷ unique eligible $67 buyers |
| Revenue per qualified lead | Total paid, non-refunded Shopify revenue in the same 14-day opt-in cohort ÷ unique qualified KO lead |
| Buyer CPA / booked ROAS | Meta spend matched to the KO campaign contract, divided into confirmed Shopify buyer or paid/non-refunded Shopify revenue; do not use Meta-reported value as authority |

The $199 revenue must be reported as an **incremental attach**, not a second $67 conversion and not a replacement order. The dashboard should show the native and email-fallback attachment routes separately. This makes the limitations of wallet payments visible instead of burying them in a single blended rate.

### Meta measurement rule

Shopify states that third-party analytics using the Shopify Pixel API report only the initial purchase and initial value for post-purchase offers.[3] Therefore, do not use Meta’s Purchase value to judge the Shopify $199 attach rate. The Content Hub’s Shopify paid-order data is the revenue authority.

Do not add a new Meta Purchase event for the full modified order without a written deduplication design; doing so risks making Meta report the original $67 more than once. If later needed, a separate, uniquely identified incremental conversion signal can be designed after the first-party ledger is proven. It should not be used to optimize the initial test.

## Offer Copy and Page Structure

The native post-purchase card should be concise because the buyer has already paid $67. It should not recreate a long sales page.

> **Your next step is to make the protocol specific to you.**  
> Add the Gut Permeability Test + Health Coach Call for the member price of $199. You will receive the stated test kit and health-coach support so you can turn the protocol into a more informed next-step plan.

The final approved copy should name the actual test kit, the precise scope of the coach call, fulfillment timing, and the applicable refund policy. It should not say “diagnose,” “treat,” “reverse,” or make a medical-outcome promise.

## Rollout Sequence

### Phase 1: verify offer parity and checkout capability

Confirm the candidate SKU is the same business offer as the Kajabi $199 OCUS. Review installed Shopify apps and checkout settings to determine whether another post-purchase app already owns the post-purchase page. Select one app, install it only after the owner approves its terms and subscription, and configure the rule in draft or disabled mode.

### Phase 2: instrument before enabling traffic

Add the `orders/updated` attribution receiver and dashboard fields before live activation. Verify that the existing click token persists from the KO landing page through the $67 order and remains available on the modified order. Add a purchase suppression for `$199` buyers to the Klaviyo fallback sequence.

### Phase 3: controlled end-to-end QA

With explicit approval, use a low-risk test order method supported by the store. Verify the following chain: $67 paid order; native $199 offer appears for an eligible card checkout; accepted offer modifies the original order; `orders/updated` records exactly one $199 attach; the dashboard shows one eligible base buyer and one native attach; and the fallback email is suppressed. Run a separate wallet-method or forced-ineligible-path test to prove the 15-minute Klaviyo fallback behaves correctly. Do not use a paid test order without explicit approval.

### Phase 4: resume a fair path comparison

Only after Phase 3 passes should the Kajabi-vs-Klaviyo/Shopify destination test be judged on revenue. Keep creative, audience, geography, optimization event, and arm budget fixed. The remaining intended difference is the checkout ecosystem, not a missing $199 revenue opportunity.

The earliest operational read may be after at least 30 confirmed Shopify $67 buyers and a complete 7-day post-purchase/fallback observation window. A decision-quality comparison should wait until both arms have a full 14-day lead cohort and enough base buyers to make the $199 attach-rate difference meaningful. Report the base conversion, $199 attach rate, revenue per base buyer, revenue per qualified lead, buyer CPA, and booked ROAS together. CPC is a delivery diagnostic only.

## Immediate Next Action

No change is needed from Curt while the parity path is being staged. His UTM contract should remain intact so the current KO traffic continues to form a separately identifiable transport-validation cohort.

The only material decision needed is:

> **Approve the existing Zipify One Click Upsell app’s requested Shopify reauthorization, then allow configuration of one disabled $67 → $199 post-purchase rule in that app.**

After that approval, the implementation work can proceed in this order: app configuration, webhook/ledger update, Klaviyo fallback, controlled QA, owner preview, and only then live enablement.

## References

[1]: https://content.theurbanmonk.com/hub/analytics/reconciliation "Urban Monk Content Hub reconciliation dashboard"
[2]: https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer "Gut Permeability Test + Health Coach Call — $199 Member Offer"
[3]: https://shopify.dev/docs/apps/build/checkout/product-offers "Shopify: About product offers"
[4]: https://shopify.dev/docs/apps/build/checkout/product-offers/build-a-post-purchase-offer "Shopify: Build a post-purchase product offer checkout extension"
