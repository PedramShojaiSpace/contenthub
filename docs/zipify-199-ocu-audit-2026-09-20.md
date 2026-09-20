# Zipify One Click Upsell Audit — $199 Interconnected Upgrade

**Date:** September 20, 2026  
**Status:** Product page completed; Zipify authorization completed and the $67 → $199 post-purchase funnel is published. No test order was created.

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

## Zipify App Status — Historical Pre-Authorization State

Before the owner-approved access update, the installed app was **One Click Upsell** at the Shopify Admin path `Apps → One Click Upsell` and stopped at a Shopify reauthorization screen:

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

The public product template is a default Shopify product layout with no product media. Its product title carries the price and member-offer label, which forces a three-line headline and leaves a large blank media region above the purchase controls. The intended title correction is **“Gut Permeability Test + 1-Hour Health Coach Call.”** The Wistia thumbnail for the approved `vvvuj0gexg` video was downloaded as the proposed hero media. The remaining routine product-page update is to upload that approved video thumbnail as the first Shopify product image, save, then recheck the public desktop and mobile layouts. No Zipify permission or funnel setting is involved in this product-media update.

## Product-media update blocker

The intended headline correction is **“Gut Permeability Test + 1-Hour Health Coach Call”** and the prepared hero medium is the Wistia thumbnail at `https://embed-ssl.wistia.com/deliveries/837f840f08bda03b1d4146341cf68b0eaa36f8e6.jpg?image_crop_resized=960x540`. The Shopify Admin product interface can display the unsaved title draft, but its native media-upload control is not exposing an accessible file input to the automation layer. The Shopify connector’s direct product-media update also failed before writing because its active-account state is not reaching the MCP server, despite the project configuration specifying the authorized Urban Monk Productions account. Per connector safety policy, the update was not retried through the browser after that connector failure. The unsaved title change was discarded; the live product remains unchanged except for the already-saved HTML description and Wistia embed.

## Recommended no-code layout correction

The correct layout is not a second description block above the standard purchase panel. It is a dedicated `ocus-199` product template that retains Shopify’s normal product-media-left / purchase-panel-right layout, with the supplied Wistia thumbnail as the product image. The existing rich content is then moved out of the product-description field and into one Custom Liquid section immediately below Product information. This puts the video, proof and details in one full-width, coherent section without affecting other products. A non-technical step-by-step guide and the paste-ready Custom Liquid source are retained in `docs/shopify-199-product-layout-instructions-2026-09-20.md` and `docs/shopify-gut-permeability-199-custom-liquid-v2.html`.

## Authorized Zipify draft creation — 2026-09-20

The owner explicitly approved Zipify's requested Shopify access update. The authorization completed and Zipify's **Upsell Funnels** workspace is now available. A new unpublished funnel was created from scratch:

| Field | Current value |
|---|---|
| Draft funnel | `New Funnel 5` |
| Status | **Unpublished** |
| Current trigger | `Any product` — not acceptable and must be narrowed before activation |
| Required trigger | $67 Interconnected product — `UM-OTO`, product `9087631753370`, variant `48959577653402` |
| Required offer | $199 Gut Permeability Test + 1-Hour Health Coach Call — `FIT-22-OCUS-199`, product `9096395620506`, variant `48994340077722` |
| Required placement | Zipify **post-purchase** offer only; do not configure the visible Product Page Upsell or Pre-Purchase Popup modules |
| Publication | Not published; no buyer can see the draft |

The embedded Zipify editor does not expose its inner controls to the connected browser automation. The owner has opened the editor in the real browser, so the remaining selection steps must be performed in that editor with exact guided values. No live rule, upsell, price, product, checkout, advertising, or traffic behavior has changed.

## Verified Zipify behavior and setup references — 2026-09-20

Current Zipify documentation confirms the intended architecture. A **post-purchase offer** sits between Shopify checkout and the thank-you page; on supported eligible checkouts, a customer accepts the offer in one click without re-entering payment or shipping details, and the accepted product is automatically edited into the original order. The selected $199 offer is a simple Shopify product, not a Shopify Bundles API item, so it fits the documented product-compatibility requirement.

The blank funnel’s default `Any product` trigger must be replaced through **Advanced trigger settings** with a **Product is** condition for the exact $67 Interconnected product. Zipify distinguishes a Product trigger (which covers future variants) from a Product Variant trigger (which must be manually expanded if variants change); for this controlled test, the exact currently-approved `$67` variant must be chosen or confirmed when presented by Zipify.

Within the Funnel Builder, the correct offer slot is **Post-Purchase Upsell 1**. The configuration is: `Add product(s) to the customer's order` → `Select the product(s) manually` → select the single $199 product → `Add`. This produces Zipify’s single-product post-purchase page, which supports long-form content, additional images, and a buy box. Do **not** add a Pre-Purchase popup, Product Page Upsell, second post-purchase offer, downsell, thank-you-page offer, AI offer, catch-all rule, or extra product.

Zipify Help Center references used:

1. [Trigger Types & Conditions](https://help.zipify.com/en/articles/6381023-trigger-types-conditions-ocu)
2. [General Information About Post-Purchase Offers](https://help.zipify.com/en/articles/6906421-general-information-about-post-purchase-offers-ocu)
3. [Adding Offers Into a Funnel](https://help.zipify.com/en/articles/6381036-adding-offers-into-a-funnel-ocu)

The funnel must remain **Unpublished** after saving the draft. No live test order, buyer exposure, or activation is authorized at this stage.

## Draft verification — trigger and offer placement

The draft was re-opened and visually verified after configuration. It is still marked **Unpublished**. The trigger area now shows `Product` with **1 product selected**, which limits the funnel to the selected $67 Interconnected trigger product; the UI wording `is any` refers to the list of selected products, not to every product in the store.

The $199 product has been added in the correct **Post-Purchase Upsell Offer #1** position. Zipify displays it as a single-product offer with `Active` and `100%` within the draft configuration. This does **not** make it live: the overall funnel status remains Unpublished. The following intentionally remain empty: Post-Purchase Upsell #2, Downsell, Product Page Upsell, Pre-Purchase Upsell Popup, and Thank You / Order Status Page Upsell.

The remaining draft-only work is to customize the Zipify offer page copy and visuals, confirm no unintended discount is applied, use a 100% display allocation inside this one-offer draft, give the funnel a clear internal name, and retain the overall funnel as **Unpublished** pending owner review. No customer can see or accept the offer until publication.

## Publication check — 2026-09-20, 14:56 Central

The owner published the configured Zipify funnel. Direct Shopify Admin inspection now shows the internal funnel name beginning **“Interconnected $67 → $199…”**, status **Published**, and an available **Unpublish** control. The trigger still shows a Product condition with one selected product. The Product Page Upsell and Pre-Purchase Upsell Popup sections are visibly empty. The previously verified $199 offer is retained in the dedicated Post-Purchase Upsell #1 placement.

This confirms that eligible future orders matching the selected trigger can be shown Zipify’s post-purchase one-click screen. It does not establish the final paid-order path or measurement accuracy. No test order was created during this verification. The next observation target is the first genuine qualifying $67 Interconnected order, after which the native offer view, acceptance/decline outcome, and modified-order attribution must be reconciled.
