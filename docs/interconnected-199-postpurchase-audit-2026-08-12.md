# Interconnected $199 Post-Purchase Landing-Page Audit — 2026-08-12

## Current Assets and Constraints

| Item | Verified state | Implication |
|---|---|---|
| $199 Shopify offer | **Gut Permeability Test + Health Coach Call — $199 Member Offer**, product `9096395620506`, variant `48994340077722` | The product is the appropriate checkout SKU for the treatment |
| Product status | `DRAFT` with no Online Store URL and no description | It cannot currently accept a Shopify checkout; keep it unchanged until an explicit controlled-activation decision |
| Existing Kajabi $199 OCU URL | Returns an HTTP 500 during review | It is not a dependable page or control for this treatment |
| Video | Existing member-offer Wistia video ID `vvvuj0gexg` | Use it near the primary decision point, with visible text value stack and support information |
| Existing $67 route | `/interconnected/thank-you-klaviyo` | The page is a pre-purchase $67 decision page and must remain unchanged |

## Shopify Post-Purchase Finding

Shopify does support a native post-purchase extension that can appear after a successful payment but before the Order status page. It is a separate Shopify app/checkout-extension build, requires live-store access approval, has payment-method and channel limitations, and should not be treated as a generic auto-redirect mechanism. In particular, it will not reliably appear for wallet and installment payment methods. [1]

The current Content Hub is not a Shopify post-purchase checkout extension. A forced external redirect from Shopify's standard order-status page to the Manus landing page is not the safe implementation route. The practical treatment architecture is therefore:

```text
Confirmed $67 Shopify order
  → Shopify order-status page remains intact
  → Klaviyo "Placed Order" flow, filtered to the $67 variant and excluding $199 buyers
  → immediate post-purchase message with the dedicated Manus $199 landing-page URL
  → one tracked $199 Shopify checkout CTA
  → Shopify paid-order webhook attributes the purchase to the original $67 cohort and the $199 closing touch
```

This produces a complete post-purchase page experience without claiming a Shopify native one-click upsell. The landing page should accurately state that the $199 offer is a separate purchase and must use plain, verified value-stack language: a Gut Permeability Test kit and a private health-coach call. It must not promise diagnosis, treatment, or a particular health outcome. The page must also retain the no-refund rule for opened test kits.

## Required Activation Choice

The page can be built now as an unpublished Manus route. It cannot safely hand a buyer into a working Shopify checkout until the $199 product becomes purchasable. The controlled production option is to change the product from `DRAFT` to `ACTIVE` while keeping it out of navigation, collections, search merchandising, and general campaign links, then use its private tracked cart link solely from the $199 landing page.

Do not change the Shopify product status or public visibility without explicit approval because the current operating rule is that the OCUS product stays hidden and Draft.

## Treatment Design and Build

The isolated landing page is available at `/interconnected/post-purchase-199-klaviyo`. It uses the supplied $199 Wistia video (`vvvuj0gexg`) beside the first decision point and follows a dedicated post-purchase sequence: immediate context from the $67 purchase, test-kit and health-coach value stack, clear separate-purchase disclosure, step-by-step delivery explanation, FAQ, and the required opened-kit final-sale disclosure.

The page fires `ViewContent` and, on CTA selection, `InitiateCheckout` with a $199 value. Its CTA uses the Content Hub’s first-party checkout bridge and the exact $199 Shopify variant. The checkout link retains the established `interconnected_14day` campaign so the existing 14-day acquisition cohort ledger can credit the original $67 lead correctly; the separate `$199` closing touch is identified by `utm_content=post_purchase_199_klaviyo_v1_checkout`.

The Klaviyo activation design is a **Placed Order** flow: trigger on a confirmed Shopify $67 purchase, filter to the Interconnected $67 variant, suppress customers who have already purchased the $199 variant, and send the page URL through the email or SMS path. It does not attempt to force the browser away from Shopify’s standard order-status page and does not describe the purchase as one-click.

## References

[1] Shopify, “About product offers,” https://shopify.dev/docs/apps/build/checkout/product-offers
