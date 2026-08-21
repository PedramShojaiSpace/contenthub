# Shopify Oral Landing Page Migration Audit — 2026-08-21

## Approved Source and Commerce Configuration

The supplied `Oral.tsx` file is the approved source for structure, pricing, CTA labels, visual direction, FAQs, and legal copy. It must not carry forward its artificial scroll-triggered `begin_checkout` or CTA-click `purchase` events. The existing Shopify product is **Orobiome Testing Package** (`gid://shopify/Product/8666586972314`), handle `orobiome-testing-package`, with one in-stock default variant (`gid://shopify/ProductVariant/46719608946842`) priced at **$399.00**. The product has a storefront URL at `https://shop.theurbanmonk.com/products/orobiome-testing-package` and a single Shopify-hosted product image.

## Theme and Publication Safeguards

The active Shopify theme is **Mediva**. A separate theme titled `shopify-advertorial-theme` is already listed as a draft. No active-theme file, live page route, product setting, navigation item, redirect, storefront analytics base tag, or checkout has been modified. The proposed safe implementation path is a dedicated draft theme and an unpublished page/template with a preview-only link.

Shopify’s current Admin GraphQL documentation confirms that unpublished themes are inactive, theme duplication creates an isolated draft, and a theme’s templates/assets can be read through the `theme` query. Theme-file writes use `themeFilesUpsert` and require both `write_themes` and Shopify’s theme-file exemption; that permission will be verified before relying on the API for any draft-theme write. The complete draft-theme inventory includes the active **Mediva** theme (`gid://shopify/OnlineStoreTheme/147605192858`) and `shopify-advertorial-theme` (`gid://shopify/OnlineStoreTheme/154836861082`), along with historical unpublished themes. Sources: https://shopify.dev/docs/api/admin-graphql/latest/objects/OnlineStoreTheme and https://shopify.dev/docs/api/admin-graphql/latest/mutations/themeFilesUpsert.

## Content Guardrails

The final draft may reuse supplied non-testimonial education, pricing, benefit, FAQ, disclaimer, support, and partner-attribution content. Customer quotes, star ratings, “verified customer” labels, and other testimonial-style content from the supplied source will be excluded from the new landing page, pending a compliant verified-review workflow. CTA actions will carry `bg_ref=109Nl4h0Ds` and use native Shopify cart/product behavior; no synthetic purchase or checkout event will be added.

## Draft Page Created

Because the current Shopify connector does not have Shopify’s required theme-file exemption, it cannot duplicate or write a theme. A safe native Shopify **Page** draft was therefore created instead, which satisfies the requested “template or page” constraint without altering the active theme. The page is **Orobiome Oral Microbiome Test — Natalie Jill Draft** (`gid://shopify/Page/129449328794`), handle `oral`, and `isPublished: false` (Hidden). It uses the active Mediva default page template, embeds the scoped responsive landing-page CSS/HTML in the page body, preserves the supplied Natalie Jill visual hierarchy, keeps all CTAs on the existing Shopify product URL with `bg_ref=109Nl4h0Ds`, and does not add React, Tailwind, third-party libraries, duplicate base pixels, scroll-triggered checkout events, or CTA-click purchase events. An authenticated in-admin visual preview confirms the hero styling and hidden status.

The authenticated Shopify editor preview confirms that the hidden page renders through the active Mediva shell while remaining invisible to the public: the direct public URL returns a Shopify 404, and the editor marks the page as Hidden. The initial preview exposed the default theme’s own page-title/hero gap above the scoped content. The page-body CSS was updated to suppress that generic page heading and its spacing only when `#oral-natalie-jill` is present. No live-theme file was changed. The CTA design is also being refined to use the current default Shopify variant (`gid://shopify/ProductVariant/46719608946842`) through a native `/cart/<variant>:1` path with `bg_ref=109Nl4h0Ds`, rather than a synthetic conversion event or cross-domain redirect.

The owner’s authenticated preview route is `https://admin.shopify.com/store/theurbanmonkstore/themes/147605192858/editor?previewPath=/pages/oral?view=page`. The editor labels the selected resource as **Orobiome Oral Micro...** and **Hidden**, enabling review without publishing. The hero loaded within the Shopify editor’s preview canvas. The public store URL `https://shop.theurbanmonk.com/pages/oral` returned the store’s standard 404, confirming that no public route is live.

## Sales-Page Presentation Preview

The store already contains a non-live theme named **shopify-advertorial-theme** (`gid://shopify/OnlineStoreTheme/154836861082`, role `UNPUBLISHED`). Its authenticated preview renders the hidden oral page as an advertorial: the full Mediva store navigation and footer are absent, while a minimal Urban Monk Insider masthead remains. The preview URL is `https://admin.shopify.com/store/theurbanmonkstore/themes/154836861082/editor?previewPath=/pages/oral?view=page`. The theme editor identifies this theme as **Draft** and the oral page as **Hidden**; nothing was published or activated. The active Mediva theme (`gid://shopify/OnlineStoreTheme/147605192858`) and public header/footer remain unchanged.

Read-only theme-file inspection independently confirms the visual preview: `layout/theme.liquid` declares an `advertorial-body`, explicitly omits the header, navigation, announcement bar, and footer, and renders only the main content area. The default `page.json` uses the `main-page-advertorial` section, so the hidden `oral` page uses the sales-page presentation when previewed in this theme. Desktop visual inspection confirms the result: only the compact Urban Monk Insider sponsored masthead appears above the landing-page hero; the full Mediva navigation is absent. Mobile preview remains a separate pending check.

The remaining Insider masthead is generated by the advertorial section itself (`sections/main-page-advertorial.liquid`, class `.adv-pub-header`), not by the main-store header. It has been suppressed with the hidden oral page’s own scoped CSS selector—`body:has(#oral-natalie-jill) .adv-pub-header`—rather than by editing the theme. The selector can only apply to the `oral` landing-page body and does not affect the active Mediva store, other pages in the advertorial theme, or public navigation.

After the hidden-page update, the authenticated advertorial preview was reloaded and visually confirmed to begin with the page’s own Natalie Jill welcome band and oral-biome hero. The Urban Monk Insider masthead is no longer displayed. The page remains Hidden and the selected `shopify-advertorial-theme` remains Draft.

## Active Mediva Theme: Native Headerless Assignment

The prior preview was not the authoritative active-theme rendering. The owner’s screenshot correctly showed the Mediva shipping bar, social icons, logo/menu, search, account, and cart controls because the hidden `oral` page was still assigned to the default page template. Read-only inspection of the active Mediva layout established that it already conditionally omits all header-group, featured-group, and footer-group output whenever the template is `page.advertorial`.

The hidden page has now been assigned to the existing active-theme `advertorial` template (`templateSuffix: "advertorial"`). Shopify confirms the page remains unpublished. Reloaded active-theme preview evidence shows the header and main-store navigation are absent; the preview begins with the page’s own Natalie Jill welcome band and hero. No shared theme file, navigation setting, product, pixel, redirect, or public page was modified.

## Published Customer Route and Affiliate Attribution

With explicit owner approval, the `oral` page was made visible. Shopify returned `isPublished: true` with no mutation errors. The live customer route is `https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds`.

The BixGrow Affiliate profile for **Natalie Jill Hollan** (`natalie@nataliejill.com`) is Approved in the Gateway Influencer program. Her personalized BixGrow referral URL is `https://shop.theurbanmonk.com?bg_ref=109Nl4h0Ds`, confirming that the page-level referral parameter and the native cart CTA’s `bg_ref=109Nl4h0Ds` use the same verified tracking ID. Public-browser validation confirmed that the affiliate-aware page URL renders the published sales page and its primary community-offer CTA without the standard store navigation. No shared theme component, product, pricing, pixel, redirect, or unrelated page changed.

The BixGrow profile was re-opened in the authenticated Shopify admin at affiliate ID `1195413`, where the Affiliate assets panel displays the personalized URL ending in `bg_ref=109Nl4h0Ds`, alongside Natalie’s `natalie@nataliejill.com` identity and Gateway Influencer program. A direct public HTML inspection of the published page found the rendered native cart CTA `https://shop.theurbanmonk.com/cart/46719608946842:1?bg_ref=109Nl4h0Ds`; the live entry URL and purchase CTA therefore retain the same approved BixGrow attribution ID.

## Approved Visual-Only Readability Repair

The owner approved a page-scoped visual repair and separately requested a CRO proposal, with no CRO implementation authorization. The approved visual scope removes the inherited white canvas below the oral footer by resetting only the active Mediva advertorial wrapper when `#oral-natalie-jill` is present. It also raises baseline, body-copy, supporting-label, FAQ, pricing-support, disclaimer, and CTA-label typography while preserving every existing offer, price, CTA count, CTA wording, destination, and BixGrow parameter. The update payload explicitly preserves `isPublished: true`; it cannot re-hide the live page.

The published page accepted the visual update and remained public. Live browser inspection confirms the inherited blank canvas is now dark rather than white and the hero/body typography is visibly larger. The remaining post-footer empty area is still larger than intended, so this visual-only repair remains in progress; no offer, price, CTA, or conversion-copy edit has been made.

Read-only inspection of Mediva’s active layout identified the residual cause: the theme applies a four-row CSS grid to every body, including headerless `page.advertorial` pages. The oral page now includes a page-scoped `display:block` and `min-height:0` reset on that body only, allowing the post-footer region to collapse naturally without touching shared theme files.

The first wrapper reset preserved the public page and its readable typography but did not fully collapse the post-footer area. The remaining space appears after the page footer and before the Shopify preview chrome, consistent with a direct layout child rendered by Mediva’s grid-based body shell. The next inspection is restricted to those active-theme direct children; no conversion element has changed.

## Final-Viewport Background Determination

Independent diagnosis now confirms that the page structure is minimal—`MainContent` contains one article, which contains the `oral-natalie-jill` container and its `oral-footer`; no trailing Shopify section or non-zero-height sibling is rendered after the footer. The former white canvas was structural and has been removed. The remaining dark visual area at the end of a viewport is the page/background color visible after the short custom footer ends, not a scrollable blank section or a shared-template defect.

No further structural or shared-theme edit is recommended. If the owner wants a more visually complete ending, the safe next step is a **page-scoped footer-finish treatment**—for example, extending the existing oral footer’s visual background to occupy the remaining viewport. This is a design choice, not a defect fix, and requires separate approval.

## Instagram-Origin Readability Pass

Following owner direction, the page received a stronger all-text typography scale beyond the first readability adjustment. The body baseline, hero lead, CTA labels, trust details, section copy, card/FAQ copy, pricing explanation, footer text, and disclaimer were increased together with line-height. The live public route remains published and keeps the exact three native Shopify cart CTAs and Natalie Jill BixGrow `bg_ref=109Nl4h0Ds` attribution. A rendered 390 px mobile check confirms the hero, CTA, secondary link, and trust detail copy are readable without changing offer content, pricing, CTA copy, destinations, or affiliate behavior.
