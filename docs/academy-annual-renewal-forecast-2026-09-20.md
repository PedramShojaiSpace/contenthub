# Urban Monk Academy Annual Renewal Forecast

**Prepared by:** Manus AI  
**As of:** September 20, 2026 (America/Chicago)  
**Forecast period:** September 21–December 31, 2026  
**Currency:** U.S. dollars

## Conclusion

Kajabi currently indicates **four active Urban Monk Academy annual subscriptions** with an estimated renewal falling before year-end. Their **gross scheduled value is $9,996**. All four belong to the legacy annual Academy offer priced at **$2,499 per year**. No active renewal was identified in the remaining standard $297 annual, $290 annual-trial, or book-reader annual Academy offers during this period.

| Period | Annual renewals | Gross scheduled cash |
|---|---:|---:|
| November 2026 | 2 | $4,998 |
| December 2026 | 2 | $4,998 |
| **Remaining 2026 total** | **4** | **$9,996** |

This is a **gross cash forecast**, not recognized revenue, net cash, or a collection guarantee. It excludes processing fees, taxes, refunds, chargebacks, failed renewal attempts, cancellations, manual billing changes, upgrades, and downgrades.

## What Was Counted

The analysis reviewed the complete set of **7,150 active Kajabi purchase records** across 286 pages, then isolated records attached to the known Urban Monk Academy annual offers. Seven active annual Academy purchases were found. Four have a calculated annual anniversary between September 21 and December 31, 2026.

| Annual Academy offer | Active purchases found | Renewals before year-end | Annual billing value | Gross forecast |
|---|---:|---:|---:|---:|
| Legacy Academy annual free-trial offer | 7 | 4 | $2,499 | $9,996 |
| Standard Academy annual | 0 | 0 | $297 | $0 |
| Academy annual book-reader / 30-day-trial offer | 0 | 0 | $297 | $0 |
| Academy annual $9 / two-week-trial offer | 0 | 0 | $290 | $0 |
| **Total** | **7** | **4** | — | **$9,996** |

## Method and Limitation

Kajabi’s public API provides **active purchase status** and the purchase’s **effective start date**, but it does **not** return an authoritative `next billing date`. The forecast therefore defines the expected renewal as the effective start date plus one year, after excluding purchases with an explicit deactivation timestamp.

> This makes **$9,996 a planning forecast, not committed cash**. The legacy offer carries a free-trial designation, and a trial period, failed payment recovery, cancellation timing, payment-method update, or manual billing adjustment can move the actual charge date or amount.

The count and price-level coverage are strong because the full active-purchase pagination was scanned. The scheduled timing is **moderate confidence** because of the absent next-billing-date field. Before putting this number into a cash plan, reconcile the four aggregate expected renewals against Kajabi **Sales → Payments → Subscriptions** and retain only those showing an active status and a next payment date through December 31.

## Basis, Time, and Sources

**Basis:** Active Urban Monk Academy annual purchase records only. A record is included if it belongs to an identified annual Academy offer, is not explicitly deactivated, and its calculated annual anniversary falls after September 20 and on or before December 31, 2026.

**Time:** Data was read as of September 20, 2026 in the America/Chicago operating time zone. The forecast period ends on December 31, 2026.

**Assumptions:** Each active annual purchase renews at the price embedded in its offer definition. The forecast assumes no cancellation, payment failure, refund, discount, upgrade, downgrade, manual billing change, or trial-related billing offset.

**Sources and confidence:** Primary transaction and purchase data came from the authenticated Kajabi API. The API documentation confirms that purchases include effective start and deactivation fields but does not provide a next-billing-date field.[1] The renewal-date calculation is therefore a schedule-based estimate; the subscription-management interface remains the final operational source for actual next charge dates.

## References

[1]: https://app.kajabi.com/api-docs "Kajabi API V1 Documentation"
