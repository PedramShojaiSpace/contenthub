# Klaviyo Thank-You Expiry-State Incident — 2026-09-10

## Scope

The public `/interconnected/thank-you-klaviyo` page was reported as showing **“This special offer has expired”** to an arriving visitor, even though the approved $67 Shopify product handoff remained available.

## Root Cause

The page’s 15-minute display timer read the generic local-storage key `ty_offer_end_time`. That key could hold a timestamp created by a different or earlier thank-you experience. When the stored timestamp was already in the past, the page immediately set its local `expired` state and displayed an expired-offer message. The direct Shopify handoff itself was not disabled, but the visible message was contradictory and conversion-hostile.

## Correction

The Klaviyo treatment now uses the isolated key `ic_klaviyo_offer_end_time_v2`. On first arrival, an expired, malformed, or absent value is replaced with a new active 15-minute display window. A timer that subsequently reaches zero no longer says the special offer expired; it tells the visitor that the viewing timer ended while full access remains available below.

## Explicitly Unchanged

The approved $67 offer, tracked `buildInterconnectedKlaviyoCheckoutUrl` handoff, destination Shopify product page, Klaviyo email CTA, flow status, email/SMS settings, consent behavior, pricing, product, checkout, and traffic rules are unchanged. No message was sent.

## Validation

Focused automated coverage verifies that the treatment no longer shares `ty_offer_end_time`, retains active current values, and refreshes expired or malformed values. Public-route and checkout-handoff verification are required after deployment.

## Published Verification

After publication, the public custom-domain route was re-opened at `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`. It rendered the active Interconnected handoff experience with its available all-access CTA and did not show the former **“This special offer has expired”** message. The checkout-helper regression suite continues to assert the approved tracked Shopify handoff is retained; no checkout was initiated during verification.
