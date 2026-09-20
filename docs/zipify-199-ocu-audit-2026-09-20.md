# Zipify One Click Upsell Audit — $199 Interconnected Upgrade

**Date:** September 20, 2026  
**Status:** Product page completed; Zipify configuration inspection is blocked pending the app’s explicit Shopify reauthorization. No Zipify funnel, app permission, checkout behavior, traffic, or payment setting was changed.

## Verified Shopify Product

| Item | Verified value |
|---|---|
| Shopify product | **Gut Permeability Test + Health Coach Call — $199 Member Offer** |
| Product ID / variant | `9096395620506` / `48994340077722` |
| SKU | `FIT-22-OCUS-199` |
| Price / compare-at price | $199 / $299 |
| Public status | Active, Online Store available |
| Included offer | KBMO FIT-22 food sensitivity panel + gut permeability test and a private one-hour health-coach consultation |
| Approved member-offer video | Wistia `vvvuj0gexg` |

The owner confirmed that this is the intended $199 Shopify offer for the Interconnected upgrade path.

## Completed: Product Description and Video Embed

The live Shopify product description was replaced with a conversion-focused, mobile-safe HTML layout. It now includes the existing Wistia member-offer video, a clear value stack, the $199 member-price context, the two included items, a three-step process, and the required non-diagnosis / opened-kit disclosure language.

Public verification confirmed that the product page renders the new description and retains the Wistia iframe at a responsive 1100 × 620 pixels. The raw, reusable HTML is retained in `docs/shopify-gut-permeability-199-description-v1.txt`.

## Zipify App Status

The installed app is **One Click Upsell** at the Shopify Admin path `Apps → One Click Upsell`. It currently stops at a Shopify reauthorization screen:

> **One Click Upsell needs access to:** View and edit store data; Edit Online Store Theme.

This is a change to the app’s authorized access. It was not accepted during the audit. The app must be reauthorized before its existing upsell funnels, custom HTML capacity, and checkout placement can be inspected.

## Configuration Contract After Reauthorization

Once the owner approves the app access update, use the existing Zipify instance—not a second upsell app—to build one new disabled/draft offer.

| Setting | Required value |
|---|---|
| Trigger product | Paid $67 Interconnected product `UM-OTO` / product `9087631753370` / variant `48959577653402` |
| Offer product | `FIT-22-OCUS-199` / product `9096395620506` / variant `48994340077722` |
| Offer price | $199; retain $299 compare-at only if Zipify carries Shopify’s genuine compare-at price automatically |
| Offer position | Zipify’s post-purchase one-click screen after an eligible $67 checkout and before the order-status page |
| Offer count | One $199 offer only during the parity test—no downsell or additional post-purchase offer |
| Custom content | Reuse the verified Wistia embed `https://fast.wistia.net/embed/iframe/vvvuj0gexg?seo=true&videoFoam=true`, subject to the app’s HTML editor and iframe policy |
| Exclusions | Orders already containing `FIT-22-OCUS-199`; prior $199 buyers; cancelled, refunded, non-paid, and test orders |
| Decline path | Normal Shopify order-status page with no forced external redirect |
| Fallback | Klaviyo post-purchase recovery remains for payment methods that cannot receive the native one-click screen |

The exact copy structure for the Zipify custom block should be concise because the buyer has already paid for the $67 product:

> **Make your next step more specific.** Add the Gut Permeability Test + Health Coach Call for the private member price of $199. This includes the KBMO FIT-22 food sensitivity panel and gut permeability test, plus a private one-hour health-coach consultation.

The final Zipify rule must be kept **disabled** until the existing Shopify first-party ledger can handle the `orders/updated` event for an accepted post-purchase offer. This is required to report $199 upgrade revenue as an incremental attach without double-counting the original $67 purchase.

## Required Owner Approval

The next necessary action is not a content decision. It is an app-permission decision:

> Approve the **One Click Upsell** app’s Shopify reauthorization request for **View and edit store data** and **Edit Online Store Theme**, then allow the existing Zipify funnel configuration to be inspected in disabled/draft mode.

After that approval, the next step is a read-only review of existing Zipify funnels and capabilities, followed by a draft-only $67 → $199 rule and an owner preview before any activation.

## Above-the-fold product-page correction — 2026-09-20

The public product template was a default Shopify product layout with no product media. Its product title carried the price and member-offer label, which forced a three-line headline and left a large blank media region above the purchase controls. The product title has therefore been shortened to **“Gut Permeability Test + 1-Hour Health Coach Call.”** The Wistia thumbnail for the approved `vvvuj0gexg` video was downloaded as the proposed hero media. The remaining routine product-page update is to upload that approved video thumbnail as the first Shopify product image, save, then recheck the public desktop and mobile layouts. No Zipify permission or funnel setting is involved in this product-media update.

## Product-media update blocker

The intended headline correction is **“Gut Permeability Test + 1-Hour Health Coach Call”** and the prepared hero medium is the Wistia thumbnail at `https://embed-ssl.wistia.com/deliveries/837f840f08bda03b1d4146341cf68b0eaa36f8e6.jpg?image_crop_resized=960x540`. The Shopify Admin product interface can display the unsaved title draft, but its native media-upload control is not exposing an accessible file input to the automation layer. The Shopify connector’s direct product-media update also failed before writing because its active-account state is not reaching the MCP server, despite the project configuration specifying the authorized Urban Monk Productions account. Per connector safety policy, the update was not retried through the browser after that connector failure. The unsaved title change was discarded; the live product remains unchanged except for the already-saved HTML description and Wistia embed.
