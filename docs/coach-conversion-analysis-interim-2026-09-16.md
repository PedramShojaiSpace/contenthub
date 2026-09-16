# Coach Appointment-to-Purchase Conversion Analysis

**Status:** Interim 12-month analysis; complete for Bruce Jones, Deanna Clausen, and Naomi Hyman. **Sarah Besocke cannot yet be calculated** because the supplied Calendly export contains no Sarah-hosted appointment records.

## Executive readout

Across the defined twelve-month window, **Bruce Jones** produced the highest observed consultation-to-Explore conversion at **15.0% (31 of 206 unique sales-consult invitees)**. His observed Explore-to-big-ticket progression was **41.9% (13 of 31)**. Deanna Clausen and Naomi Hyman both converted approximately **4.7%–4.8%** of unique sales-consult invitees into Explore purchases, with Deanna producing a higher observed Explore-to-big-ticket progression than Naomi.

The basic-to-high-ticket samples are small—only 3, 14, and 12 attributed basic purchasers for Bruce, Deanna, and Naomi, respectively—so those percentages should be treated as directional rather than used for compensation, ranking, or forecast decisions.

| Coach | Eligible sales-consult appointments | Unique sales-consult invitees | Basic → high-ticket | Consult → Explore | Explore → big-ticket |
|---|---:|---:|---:|---:|---:|
| Bruce Jones | 246 | 206 | 0 / 3 = **0.0%** | 31 / 206 = **15.0%** | 13 / 31 = **41.9%** |
| Deanna Clausen* | 417 | 356 | 1 / 14 = **7.1%** | 17 / 356 = **4.8%** | 4 / 17 = **23.5%** |
| Naomi Hyman | 416 | 365 | 2 / 12 = **16.7%** | 17 / 365 = **4.7%** | 2 / 17 = **11.8%** |
| Sarah Besocke | — | — | **Not calculable** | **Not calculable** | **Not calculable** |
| **Three-coach aggregate** | 1,079 | 927 | 3 / 29 = **10.3%** | 65 / 927 = **7.0%** | 19 / 65 = **29.2%** |

> *Calendly spells the coach’s name **Deanna Clauson**; this report presents the owner-supplied **Deanna Clausen** label while using the Calendly record for matching.*

## What each rate means

The calculations use a **180-day appointment-to-order attribution window**. Coach credit goes to the most recent eligible named-coach sales consultation that occurred before the first relevant Shopify purchase.

| Measure | Denominator | Numerator | Product definition |
|---|---|---|---|
| **Basic → high-ticket** | Unique customers with a coach-attributed basic-package paid order | Those customers who then paid for Explore or a big-ticket program within 180 days | Basic includes qualifying testing, consult, and entry-package products. High-ticket includes Explore or big-ticket programs. |
| **Consult → Explore** | Unique customers with an eligible named-coach sales consultation | Those who paid for Explore within 180 days of an eligible consultation | Explore includes the live Explore Testing Tier and Orobiome Explore Tier variants. |
| **Explore → big-ticket** | Unique coach-attributed Explore purchasers | Those who later paid for a big-ticket program within 180 days | Big-ticket includes SAGE, Catalyst, FMT, and Deep Sleep Solution SAGE program variants. |

The full-period figures above show **observed in-window outcomes**. Recent appointments and purchases have not all had a full 180 days to mature, so the figures are appropriate as operational reporting rather than a final cohort-performance scorecard.

## Maturity sensitivity

Restricting the analysis to cohorts with a full 180 days to mature materially reduces the samples. This is why the observed figures are shown as the primary operational view, with maturity caveats retained.

| Coach | Matured consult → Explore | Matured Explore → big-ticket | Interpretation |
|---|---:|---:|---|
| Bruce Jones | 3 / 41 = **7.3%** | 2 / 2 = **100.0%** | Explore progression denominator is too small for a reliable comparative conclusion. |
| Deanna Clausen | 4 / 218 = **1.8%** | 1 / 4 = **25.0%** | Big-ticket progression denominator is too small for ranking. |
| Naomi Hyman | 7 / 282 = **2.5%** | 1 / 7 = **14.3%** | Big-ticket progression denominator is still small. |

## Data coverage and limitations

The supplied Calendly export contains **1,565** rows within the analysis window. After excluding 28 no-shows and 139 Lora Hooper-hosted rows, it yielded **1,398 named-coach, active, non-no-show appointments**, of which **1,019** were classified as sales-consultation event types. The three coaches above produced 927 unique sales-consult invitees. [1]

The Shopify export contained **1,774 paid orders** within the same period. The matching process found **445 appointment-email to paid-order matches** across the broader Calendly export; the lower match coverage is expected because Shopify includes direct consumer, supplement, subscription, and unrelated-store purchases that did not originate from an eligible named-coach consultation. Fully refunded and partially refunded orders are excluded from this conversion calculation. [2]

The Calendly export contains **no Sarah Besocke-hosted rows**. The separate calendar inventory shows that Sarah had appointment activity in the period, so this is an export-scope gap, not evidence of zero sales. A Sarah-specific Calendly export is required before calculating her rates. [1]

Stripe has not been included. It should remain a separate reconciliation layer unless a matching Stripe export is supplied; blending unlinked Stripe payments into the Shopify-based rates would overstate conversion and obscure auditability.

## Required final input for Sarah Besocke

Please export **Sarah Besocke’s Calendly calendar** for **September 16, 2025 through September 16, 2026** and upload the ZIP/CSV. Include these fields if the export dialog allows them: **User Name, Invitee Email, Event Type Name, Start Date & Time, Canceled, and Marked as No-Show**. I will add Sarah to the same calculation without changing definitions or reprocessing customer-identifiable information beyond the temporary hashed match step.

## References

[1]: file:///home/ubuntu/upload/events-export%282%29.zip "Owner-supplied Calendly Events Export, received September 16, 2026"
[2]: file:///home/ubuntu/upload/orders_export_1%282%29.csv "Owner-supplied Shopify Paid Orders Export, received September 16, 2026"
