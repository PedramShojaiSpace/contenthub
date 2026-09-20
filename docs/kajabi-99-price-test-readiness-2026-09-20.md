# Interconnected $99 Kajabi Price-Test Readiness

**Prepared:** September 20, 2026  
**Status:** Staged and verified; **no traffic allocation is active**.

## Verified $99 treatment contract

| Element | Verified configuration |
|---|---|
| Internal offer label | Interconnected $99 Bundle OTO |
| Exact Kajabi Offer ID | `2151402817` |
| Checkout URL | `https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout` |
| Checkout price | $99.00 one-time payment |
| Product access | Interconnected Series Self Guided |
| Post-purchase destination | Interconnected Purchased — Redirect |
| Shared OCUS | Gut Permeability and Food Sensitivity Testing w/ Coach Consultation [OCUS DISCOUNT] New Upsell |
| Shared OCUS price | $199.00 one-time payment |
| Price-test status | Draft only; no visitor allocation, campaign, ad, or budget change |

## Content Hub preparation

The public $99 treatment page is available at `https://content.theurbanmonk.com/interconnected/thank-you-p99-draft`. Its purchase calls-to-action point only to the verified $99 Kajabi checkout. The page has an arm-specific timer storage key so prior visits to other Interconnected thank-you pages cannot make the $99 treatment display as expired.

The internal Price-Test Tracker record has been updated with the exact $99 offer identifier and checkout URL, while retaining the test as `draft` with traffic allocation disabled. The $199 OCUS parity for the $99 arm was verified in Kajabi by direct inspection of its Purchase flow. The $49 treatment remains intentionally unmapped and inactive.

## Remaining owner controls

The $99 offer itself is published in Kajabi so its checkout can be reviewed manually. That does **not** route traffic to it. The user must separately approve any visitor allocation or paid-ad destination change after reviewing both the $67 control and the staged $99 treatment. When a test is authorized, decision reporting should use exact-offer cleared Kajabi revenue, paid/non-refunded buyer count, $199 OCUS uptake, buyer CPA, and booked ROAS—not CPC.

## Validation record

The relevant focused safeguards passed **18/18**, and the bounded-memory production build completed successfully. No email, SMS, Klaviyo setting, product access, traffic rule, Meta campaign, ad, or budget was created or altered in this preparation.

## Preview verification

At 10:30 on September 20, the sandbox preview of `/interconnected/thank-you-p99-draft` rendered the $99 offer, its active countdown, and each visible purchase CTA. The route did not show a false expired state. This was a view-only preview: no checkout was submitted and no form, email, SMS, tracking event, visitor allocation, campaign, ad, or budget was changed.
