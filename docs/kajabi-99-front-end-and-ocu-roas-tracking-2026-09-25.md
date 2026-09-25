# $99 Interconnected Front-End and Upstream OCU ROAS Tracking

**Author:** Manus AI  
**Date:** 25 September 2026  
**Status:** Implemented and validated against the direct Kajabi transaction feed

## Result

The Content Hub now treats the current **$99 Interconnected front-end offer** and the **$99 Upstream OCU** as separate Kajabi revenue tiers. They have the same price, so price-based reporting alone would be inaccurate. Each transaction must match both its exact Kajabi offer ID and its expected paid amount before it is counted.

The Command Center’s **Kajabi Revenue**, purchase count, and ROAS numerator now include each paid current-path transaction. The $99 front-end purchase is not blended into the $99 Upstream OCU, the $67 legacy/control offer, the $199 testing OCU, historical $299 revenue, Shopify revenue, or unrelated Academy transactions.

## Current exact-offer map

| Funnel step | Exact Kajabi offer ID | Expected paid amount | Reporting tier |
|---|---:|---:|---|
| Interconnected control/front end | `2151314475` | $67.00 | Interconnected $67 Bundle OTO |
| Interconnected $99 front end | `2151402817` | $99.00 | Interconnected $99 Bundle OTO |
| Upstream digital OCU | `2151104453` | $99.00 | Upstream: Complete Microbiome Solution ($99 OCUS) |
| Testing OCU | `2151333044` | $199.00 | Gut Permeability + Food Sensitivity Test w/ Coach ($199 OCUS) |

## Direct Kajabi validation snapshot

For the Central-time period beginning **23 September 2026**, the direct Kajabi transaction API returned the following paid exact-offer aggregate. This is a booking snapshot, not an attribution claim about individual ads or message clicks.

| Tier | Paid purchases | Confirmed revenue |
|---|---:|---:|
| $67 Interconnected control/front end | 13 | $871.00 |
| $99 Interconnected front end | 1 | $99.00 |
| $99 Upstream OCU | 2 | $198.00 |
| $199 testing OCU | 0 | $0.00 |
| **Current exact-offer total** | **16** | **$1,168.00** |

This confirms the first paid $99 front-end transaction and two paid Upstream OCU transactions are present in Kajabi and belong in the current-path revenue denominator. The Command Center now displays the $99 front end as its own card and retains the $99 Upstream OCU as a separate OCU card.

## Reporting behavior

The Command Center uses Kajabi as the revenue authority. It calculates booked ROAS as **direct exact-offer Kajabi revenue divided by the selected Meta spend**. The result is useful for operational monitoring, but it should not be read as click-level attribution because the direct Kajabi reader intentionally does not claim that every order was caused by a specific ad, email, or SMS.

The Upstream OCU and $199 OCU cards calculate their take rates against all paid current-base buyers in the selected period: $67 buyers plus $99 front-end buyers. The OCU rates remain independent because a single buyer may accept more than one post-purchase offer.

The broader Reconciliation view also now recognizes both $99 records by exact offer ID. It will not classify an unrelated $99 Kajabi transaction as Interconnected revenue.

## Safeguards retained

- A transaction is excluded when the exact offer ID is not in the approved map.
- A transaction is excluded when its paid amount does not match the approved price for that exact offer.
- Failed, refunded, refund-action, and zero-value transactions remain excluded.
- Historical $299 results remain a benchmark only; they are not included in current-period ROAS.
- Kajabi remains the revenue source of truth. Meta remains spend and delivery diagnostics.

## References

[1]: https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout "Interconnected: The Complete Healing Protocol $99 checkout"

[2]: https://app.kajabi.com/admin/offers/2151402817/upsells "Kajabi $99 Interconnected offer purchase flow"

[3]: https://app.kajabi.com/admin/offers/2151104453/upsells "Kajabi Upstream $99 one-click upsell configuration"
