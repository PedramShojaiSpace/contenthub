# Kajabi Day 0 Offer-Page Audit — 2026-08-15

## Current findings

The Urban Monk Academy Kajabi account is authenticated in the owner browser at site ID `2148432935`. The guessed generic email URL (`/admin/marketing/email`) returned Kajabi's 404 page, so no Day 0 message was changed through that route. The dashboard is accessible and the next step is to locate the actual Interconnected email sequence through its Marketing navigation, identify the live Day 0 message, and verify its $67 CTA destination before making the owner-authorized link-only update.

Kajabi's active Email Campaigns surface is available at `/admin/sites/2148432935/email_campaigns`. Its full-text search did not return an Interconnected result in the initial current-page view, so the next audit surface is the **Marketing → Funnels** area, where the legacy Interconnected Day 0 automation may be attached.

Kajabi's Funnels surface is `/admin/sites/2148432935/pipelines`. An Interconnected search on the current funnel page did not surface a matching funnel in the visible results. The remaining likely source is **Marketing → Automations**, which must be audited before concluding that a Kajabi Day 0 message does not exist or before changing any Kajabi CTA.

## Link requirement

Both the Kajabi and Klaviyo Day 0 $67 CTAs must point to the contextual public offer page, not directly to checkout:

`https://content.theurbanmonk.com/interconnected/offer?utm_source=<platform>&utm_medium=email&utm_campaign=interconnected_14day&utm_content=day0_67_offer_email`

The contextual offer page must be publicly reachable before either platform's CTA is considered fully validated.

## Verified current state

The public page is now live and renders the contextual $67 offer correctly at `/interconnected/offer`. It explains that the daily series remains free, describes permanent access and the included resources, presents one payment of $67 with no recurring charge, and hands off through the first-party `/r/checkout` bridge to Shopify. The initially observed Hub-route response was a short deployment-propagation mismatch; a subsequent public verification returned the intended offer page.

The active Kajabi sequence is `[EG] Interconnected Free Screening -SP26 - Updated Version` (ID `2148815115`), which has 3,522 subscribers and a Day 0 message named `Day 0 opt in EG sp26` (ID `2151341113`). Its visual editor contains the existing “click here now” offer CTA in the Text section. The CTA remains to be changed to the now-live contextual offer-page URL; no Kajabi email content, sender, timing, subject, or preview text has been modified during this audit.

The corresponding live Klaviyo Day 0 action is `114303072` in flow `VMpbLV`, using Code template `WvgnhN`. A guarded dry run validated the contextual replacement: it preserves the live action, sender, and tracking setting; removes the legacy product-link CTA, two-hour urgency, and money-back-guarantee language; and leaves one contextual offer-page CTA. The visual Kajabi editor confirms that its active Day 0 message has matching free-series logistics and a separate “click here now” offer link in the Text section.

## Completed update and verification

The live Klaviyo Day 0 action now uses replacement Code template `W9A6AV`, `[LIVE] Interconnected Day 0 — Contextual $67 Offer Email`. A post-update readback confirmed that the action remains live, the subject remains `Your spot is confirmed. Here's what happens next.`, the legacy product CTA is gone, there is exactly one offer-page CTA with Klaviyo UTMs, and the contextual heading and $67 one-payment statement are present.

The Kajabi Day 0 Text section was replaced with the matching email-first contextual copy and saved through the live editor. A fresh reload of the Kajabi editor displayed the new registration-first copy, free-series logistics, and the contextual offer section in the active `Day 0 opt in EG sp26` message. The offer CTA uses the Kajabi-specific offer-page UTMs. Existing Day 0 timing, internal title, subject, preview text, header, logo, and compliance footer were retained.
