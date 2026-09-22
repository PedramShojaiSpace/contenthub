# Zipify One-Click Exposure Verification and Video-Page Test Plan

**Author:** Manus AI  
**Checked:** 22 September 2026, 9:40 a.m. Central  
**Scope:** Interconnected $67 Shopify trigger → $199 Gut Permeability Test + Health Coach Call native post-purchase offer. No setting was changed during this review.

## Verdict

The native Zipify offer is **rendering for most, but not all, currently eligible buyers**. The published Interconnected funnel shows **4 views, 0% conversion, and $0 revenue**. Shopify records **five paid, non-cancelled $67 trigger orders after the funnel was published**. This yields **80% recorded view coverage** so far.

The data does not allow a person-by-person join between a Shopify order and a Zipify view. Therefore, it cannot prove that each individual Klaviyo/Shopify buyer saw the screen. It does prove that at least one of the five post-publication eligible trigger orders did **not** create a recorded Zipify view. All five used Shopify Payments, so the current gap is not explained by payment-gateway family.

There are **zero accepted $199 offers**. The six paid $67 trigger orders since launch contain no `FIT-22-OCUS-199` line item, and their aggregate Shopify revenue is $402, which equals six $67 entry orders. This means the current $67 ROAS lead is not being inflated by an unrecorded $199 upgrade.

| Exposure measure | Verified result | Meaning |
|---|---:|---|
| Paid, non-cancelled $67 trigger orders since launch | 6 | One occurred before Zipify was published. |
| Eligible trigger orders after publication | 5 | These are the appropriate exposure denominator. |
| Recorded Zipify offer views | 4 | The screen is capable of rendering. |
| Recorded view coverage | **80%** | Exposure is not yet reliable enough for a page-performance verdict. |
| $199 offer accepts | 0 | No attach-rate result yet. |
| $199 item found in qualifying Shopify orders | 0 | No accepted native post-purchase amendment is hiding in Shopify totals. |

## What should happen next

The right next move is **not** to send a paid buyer away from the one-click experience to the public Shopify product page. That would introduce a second checkout and would no longer test the one-click upsell fairly.

Instead, use the existing video-led Shopify page as the **creative blueprint for a second Zipify offer page**. The buyer will remain on the native post-purchase screen and retain the one-click payment capability.

The comparison should preserve the following variables:

| Fixed variable | Both pages must use the same value |
|---|---|
| Trigger | The existing $67 Interconnected product only |
| Upsell product | `FIT-22-OCUS-199` only |
| Price and compare-at treatment | $199 / legitimate $299 compare-at, unchanged |
| Offer type and position | One native post-purchase offer in the same funnel position |
| Eligibility and exclusions | Existing Zipify rules unchanged |
| Success metric | Accepted $199 offers divided by recorded Zipify offer views; revenue per Zipify view as secondary |

**Page A** should remain the current Zipify offer. **Page B** should be created through Zipify’s **Same Product** split-test option, which makes an exact duplicate of the existing $199 offer page. The variation should then receive only the stronger presentation elements: Wistia video `vvvuj0gexg`, a concise problem-to-next-step headline, a three-part value stack, proof/safety language, and the existing one-click acceptance button. Price, product, trigger, and placement must not change.

Zipify’s native split-test feature supports this exact same-product design test on post-purchase offers. It sends traffic **50/50** once started, but starting it resets the offer-position statistics. [1]

## Decision gates

First, let the current native offer reach **10 post-publication eligible orders**. Do not test content until view coverage is at least **90%**. If coverage remains below that level, investigate exposure mechanics before changing the page.

After coverage passes, create Page B in draft and review it visually. Once approved, start Zipify’s 50/50 split test. Treat the first **25 recorded views per page** as a diagnostic check only. Choose a winner only after at least **50 recorded views per page**, or after a clearly sustained and material revenue-per-view difference that would justify ending early.

> The existing $199 Shopify product page is valuable source material. It should not become the buyer’s destination during the test. Its video and copy should be adapted **inside Zipify**, so the only tested variable is the offer presentation—not checkout friction or entitlement handling.

## References

[1]: https://help.zipify.com/en/articles/6381073-split-testing-offers-ocu "Split Testing Offers [OCU]"

[2]: https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer "Gut Permeability Test + Health Coach Call — $199 Member Offer"

[3]: https://help.zipify.com/en/articles/6906421-general-information-about-post-purchase-offers-ocu "General Information About Post-Purchase Offers [OCU]"
