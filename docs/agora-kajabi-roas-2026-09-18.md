# Agora Funnel ROAS Check

**Prepared by:** Manus AI  
**Checked:** September 18, 2026, approximately 6:09 PM Central  
**Funnel:** Interconnected Free Screening (Agora) → Kajabi

## Conclusion

The best current **booked-revenue ROAS** reading is **1.51x** for the aligned September 15–18 reporting window. Meta spend was **$1,323.46** and Kajabi-cleared, paid, non-refunded revenue was **$2,004.00**. This is a **gross revenue** measurement, not net profit or contribution margin.

This is not a 4.61x funnel. Meta reported 55 purchases and $6,095.40 of pixel-attributed purchase value, but that pixel figure is not a valid revenue source for a Kajabi checkout. Per the agreed measurement rule, the calculation below uses Kajabi-cleared revenue only.

| Metric | Result |
|---|---:|
| Meta spend | $1,323.46 |
| Kajabi-cleared revenue | $2,004.00 |
| Recorded revenue ROAS | **1.51x** |
| Revenue recovered per $1.00 of spend | $1.51 |
| Paid transactions | 24 |
| Blended spend per paid transaction | $55.14 |
| Meta-reported leads | 880 |
| Cost per Meta-reported lead | $1.50 |
| Observed lead-to-paid-sale rate | 2.73% |

## What made up the Kajabi revenue

The booked revenue consisted of 21 $67 Interconnected entry purchases, totaling $1,407.00, and three $199 one-click upsells, totaling $597.00. The immediate $199 upsell take rate was **12.5%** of paid entry transactions (3 of 24).

| Kajabi offer | Purchases | Revenue |
|---|---:|---:|
| Interconnected $67 Bundle OTO | 21 | $1,407.00 |
| Gut Permeability + Food Sensitivity Test $199 OCU | 3 | $597.00 |
| **Total** | **24** | **$2,004.00** |

## Important interpretation

The $1,323.46 / $2,004.00 calculation aligns the funnel’s Meta spend with its registered Kajabi offers. Shopify was not active for this funnel and was not included. The dashboard’s direct lead-match lower bound is 0.86x, but that is intentionally conservative: the current early cohort has incomplete lead-to-purchase identity matching and it is not a replacement for Kajabi-cleared booked revenue.

The date range is a **day-based reporting window** of September 15 through September 18, using the Content Hub’s Central-time report logic. It contains a $199 Kajabi transaction on September 15 at 9:24 AM Central, which predates a literal 72-hour lookback from the time of this check. Removing that known pre-window transaction produces a conservative adjusted reading of **1.36x** ($1,805.00 divided by $1,323.46). The exact rolling 72-hour ROAS would require a timestamp-level spend extract for the first partial day; Meta’s standard daily insights and Kajabi’s daily reconciliation do not split that first day at the same hour boundary.

Today’s partial-day reading was stronger: **$802.00** of Kajabi-cleared revenue against **$348.15** of Meta spend, or **2.30x**. That is encouraging, but it is too early to treat one partial day as the new steady state.

## Operating read

The restart is presently **above gross revenue break-even on the available booked-revenue data**, but it remains early and marginal enough that it should be monitored rather than aggressively scaled. The practical number to use in conversations with the ad buyer is **1.51x booked ROAS for the aligned dashboard window**, with **1.36x** as the strict conservative reading that excludes the known pre-72-hour Kajabi sale.

No ads, budgets, delivery settings, pricing, checkout settings, or traffic allocation were changed during this check.

## References

[1]: https://content.theurbanmonk.com/hub/analytics/reconciliation "Urban Monk Content Hub Sales Reconciliation"
[2]: https://adsmanager.facebook.com/adsmanager/manage/campaigns "Meta Ads Manager"
