# Interconnected Buyer Email Destination Map

**Author:** Manus AI  
**Date:** 21 September 2026  
**Status:** **Do not import final HTML yet.** This audit identifies which destinations can be used now and which require a real asset, published Kajabi content, or a decision before the buyer sequence is completed.

## Executive finding

The sequence does **not** yet have a complete set of safe, verified URLs. The paid Interconnected course itself is real and has published Episodes 1–10 plus a published Guides area. However, several resources promised in the current $67 product description and named in the Claude sequence are still shown as **draft** modules in Kajabi: the Companion Guide, Gut Restoration Protocol, and 5 Root Causes Masterclass. The buyer community and current webinar/evergreen destination were not found as verified live destinations. The $199 member testing offer is live and verified.

Because the templates are canonical HTML files rather than live emails, resolving these destinations first avoids redoing the email copy or structure later. The correct approach is to lock this map, then replace each placeholder once in the canonical HTML package before importing it into Kajabi.

## Destination map

| Placeholder | Email use | Proposed destination | Verification status | Decision or action required |
|---|---|---|---|---|
| `{{PAID_LIBRARY_URL}}` | Access delivery; Day 24 re-engagement | `https://theacademy.theurbanmonk.com/library` | **Verified entry point.** It is the public Kajabi library/log-in route. The buyer’s paid product is `Interconnected Series Self Guided`. | Use as the broad access destination unless a product-specific post-login landing route is preferred. |
| `{{PAID_EPISODE_1_URL}}` | Day 1 orientation | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | **Verified paid product route.** Unauthenticated visitors are prompted to sign in; buyers should reach their entitled product after authentication. | Safe default for now. A direct Episode 1 deep link has not yet been identified. |
| `{{PAID_SERIES_CONTINUE_URL}}` | Day 3 series activation | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | **Verified paid product route.** The course contains published Episodes 1–10. | Safe default for now. A later deep link can replace it after a buyer-authenticated route is verified. |
| `{{TESTING_MEMBER_OFFER_URL}}` | $199 recovery; Day 9 testing; Day 17 decision support | `https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer` | **Verified live Shopify $199 member-offer page.** It matches the Gut Permeability Test + 1-Hour Health Coach Call offer. | Use this exact URL. Email 2 must still be sent only after a 30-minute final-order check confirms the $199 line item is absent. |
| `{{SUPPORT_EMAIL}}` | Access support | `support@theurbanmonk.com` | **Verified public support address** on the Shopify product and $199 offer pages. | Use this exact value. |
| `{{STARTER_PROTOCOL_URL}}` | Email 1 inclusions; Day 6 protocol activation | — | **Not live.** Kajabi’s product outline shows `Gut Restoration Protocol` as a **draft** module. | Publish the actual resource and provide its buyer-accessible link, or remove/rewrite this promise from Email 1 and Day 6. |
| `{{COMPANION_GUIDE_URL}}` | Email 1 inclusions | — | **Not live.** Kajabi’s product outline shows `Companion Guide` as a **draft** module. A general published `Guides` module exists, but it was not verified as the named companion guide. | Publish the actual companion guide or point to a verified downloadable guide. Otherwise remove/rewrite the named inclusion. |
| `{{MASTERCLASS_URL}}` | Email 1 inclusions | — | **Not live.** Kajabi’s product outline shows `5 Root Causes Masterclass` as a **draft** module. | Publish the masterclass and provide its buyer-accessible link, or remove/rewrite it from the access email. |
| `{{COMMUNITY_URL}}` | Email 1 inclusion; Day 17 self-guided path | — | **Unverified.** No live community entitlement or public community entry route was identified in the product/offer audit. | Supply the intended community URL and confirm that $67/$99 buyers receive access, or remove this inclusion from the sequence. |
| `{{NEXT_WEBINAR_OR_EVERGREEN_URL}}` | Day 13 and Day 30 live-education CTA | — | **Unresolved.** Existing old flow references do not establish a current, approved live registration page or evergreen replay. | Provide the current webinar registration URL or designate a stable evergreen replay. |
| `{{BUYER_NEXT_STEP_HUB_URL}}` | Day 17 three-path decision CTA | — | **Unresolved.** No existing buyer “next step” hub was found. | Choose: create a simple buyer hub that presents self-guided continuation, $199 testing, and webinar options; or replace the single CTA with the $199 member-offer URL and revise the message accordingly. |

## What is actually published in the paid Kajabi product

The product **Interconnected Series Self Guided** is associated with both buyer offers: $67 Offer ID `2151314475` and $99 Offer ID `2151402817`. The product outline shows the 10-episode docuseries as published, including Episodes 1–10 and their audio versions. It also shows a published `Guides` area containing `Downloadable Guides`.

The following modules are currently marked **draft** in the Kajabi course outline: the gut-learning modules; `Q&A`; `Director’s Cut`; `MicroBalance: Your Personalized Gut Health Resource`; `Companion Guide`; `Gut Restoration Protocol`; and `5 Root Causes Masterclass`. Draft resources must not be named as available buyer assets until they are actually published and reachable by buyers.

## Recommended locked URL set for the first review

If the intention is to review the buyer journey without waiting for other assets, use the following four verified destinations now and replace any unsupported-resource copy before importing HTML:

| Purpose | Locked URL |
|---|---|
| Paid library entry | `https://theacademy.theurbanmonk.com/library` |
| Paid course / Episode 1 default | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` |
| Continue the paid series default | `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` |
| $199 member testing offer | `https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer` |

This gives the buyer valid paid access and a valid testing path today. It does **not** permit the emails to promise a live Companion Guide, 30-day protocol, 5 Root Causes Masterclass, community, webinar, or decision hub until those destinations are resolved.

## Required next decisions

1. Confirm whether to publish the three draft paid assets before the sequence launches, or remove their named references from the buyer emails.
2. Provide or select the live community and webinar/evergreen destinations.
3. Choose whether the Day 17 decision CTA should point to a new buyer hub or the existing $199 member offer.
4. After these choices are made, insert the locked URLs into the canonical HTML package once, run a final link test, and then import the finalized HTML into the draft Kajabi sequence.

## Sources

The paid $67 product page confirms the offered inclusions and states that access details are sent after purchase. The $199 Shopify product page confirms the current member testing destination. Kajabi’s authenticated product outline confirms the published course modules and identifies the draft modules. Existing live free-screening emails provide the current restricted `interconnected.theurbanmonk.com/episode1`–`episode10` links, which are unsuitable for paid-buyer access because they require a screening-email browser activation.

## References

[1]: https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol "Interconnected: The Complete Healing Protocol — Shopify Product Page"
[2]: https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer "Gut Permeability Test + 1-Hour Health Coach Call — Shopify Product Page"
[3]: https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided "Interconnected Series Self Guided — Kajabi Product Route"
[4]: https://theacademy.theurbanmonk.com/library "The Urban Monk Academy — My Library"
[5]: https://interconnected.theurbanmonk.com/episode1 "Interconnected Episode 1 — Screening-Access Gate"
