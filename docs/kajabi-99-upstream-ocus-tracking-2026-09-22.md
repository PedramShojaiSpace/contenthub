# Kajabi $99 Upstream OCU Tracking

**Author:** Manus AI  
**Date:** 22 September 2026  
**Status:** Implemented in the Content Hub codebase; deployment and passive live observation pending verification

## Outcome

The new post-purchase offer is now represented as a distinct **Kajabi-native revenue tier**, rather than being blended into the base Interconnected purchase, the $199 testing offer, or the older $299 benchmark.

Kajabi is the financial authority for this path. The new $99 offer was verified from the Kajabi Offers API with its exact identifier. The original $67 offer and the existing $199 post-purchase offer were also rechecked in the same pass.

| Funnel step | Kajabi offer ID | Price | Reporting label |
|---|---:|---:|---|
| Interconnected entry | `2151314475` | $67 | Interconnected $67 Bundle OTO |
| New digital OCU | `2151104453` | $99 | Upstream: Complete Microbiome Solution ($99 OCUS) |
| Existing testing OCU | `2151333044` | $199 | Gut Permeability + Food Sensitivity Test w/ Coach ($199 OCUS) |

The live $99 item is titled **“Upstream: The Complete Microbiome Solution”** and carries the Kajabi internal title **“Upstream Bundle OCUS: The Complete Microbiome Solution with Testing [OCUS ONLY].”** Its commercial price is $99.00, matching the intended $100 discount.

## What is now tracked

The Content Hub's direct Kajabi transaction reader now accepts a transaction only when **both** its exact offer ID and expected price match. Its current-period revenue rollup will therefore show three independent tiers: $67 entry, $99 Upstream OCU, and $199 testing OCU. The Interconnected Command Center has been changed to display separate cards for the $99 and $199 offers, including accepted orders, revenue, and each offer’s independent take rate relative to $67 buyers.

The calculation does not treat the two OCU take rates as mutually exclusive. If Kajabi presents both offers to a single buyer and that buyer accepts both, each acceptance is counted in its own tier. The total Kajabi revenue and booked ROAS include the actual paid transactions from each exact offer.

## Revenue-integrity safeguard

Kajabi has historically been capable of sending a generic post-purchase webhook with no usable offer ID and a zero payment value. That could previously be misclassified as a $199 OCU after a buyer had purchased the entry offer. With two live OCUs, this is no longer safe.

The receiver now records neither revenue nor a Meta Purchase for a generic zero-value post-purchase payload. It returns an explicit `ambiguous_zero_value_post_purchase` result instead. A confirmed OCU acceptance must carry either the known $99/$199 offer identity or a non-zero price. This protects booked ROAS from invented $99 or $199 revenue. Kajabi’s webhook documentation describes outbound event data, but the implementation remains intentionally conservative when those fields are absent. [1]

The staged Kajabi-to-Klaviyo buyer-event code also recognizes the verified $99 offer ID, but **its dispatch remains disabled**. No buyer-flow enrollment, email, SMS, Kajabi automation, purchase event, or audience setting was activated by this tracking work.

## Current baseline

At the tracking audit on **22 September 2026 at approximately 7:31 PM Central**, the direct Kajabi transaction API reported the following results for 20–22 September in Central Time:

| Exact offer | Confirmed purchases | Confirmed revenue |
|---|---:|---:|
| $67 Interconnected entry | 20 | $1,340.00 |
| $99 Upstream OCU | 0 | $0.00 |
| $199 testing OCU | 2 | $398.00 |
| **Current exact-offer total** | **22** | **$1,738.00** |

The $99 offer was newly placed immediately before the audit. Zero recorded acceptances at that point is a **starting baseline**, not evidence about its effectiveness.

## What was not changed

No checkout URL, Kajabi offer, OCU placement, price, paid traffic, budget, page copy, Klaviyo flow, email, SMS, product access, or customer order was changed. No test purchase was created. The configuration shown in Kajabi remains the owner-published structure: $67 Interconnected entry followed by the $99 Upstream digital offer and the existing $199 testing offer.

## References

[1]: https://help.kajabi.com/articles/api-integrations/webhooks/what-information-is-sent-with-outbound-webhooks "What information is sent with Kajabi outbound webhooks"
