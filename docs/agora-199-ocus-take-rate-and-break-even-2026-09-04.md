# Agora $199 One-Click Upgrade Economics

**Prepared:** September 4, 2026, 7:32 AM Central  
**Purpose:** Planning analysis only. Kajabi cleared transactions are the sales source of truth; Meta contributes spend, impression, and link-click delivery data only.

> This is an operating model based on a small early cohort, not a revenue guarantee or a direction to change spend. The user remains responsible for any advertising decision.

## Cohort and calculation basis

The modeled post-restart cohort covers **September 2 through September 4, 2026**, using America/Chicago calendar boundaries. The September 4 observation is a partial day through 7:32 AM Central. Kajabi returned 11 cleared exact-offer $67 base purchases and two cleared exact-offer $199 one-click upgrades. The matched Meta delivery read returned $938.91 spend, 19,954 impressions, and 1,148 link clicks.

| Observed input | Value | Calculation role |
|---|---:|---|
| Cleared $67 base purchases | 11 | Upgrade denominator and base-purchase conversion rate |
| Cleared $199 upgrades | 2 | Upgrade numerator |
| $199 upgrade take rate | **18.18%** | 2 ÷ 11 |
| Meta spend | $938.91 | Media-cost input only |
| Link clicks | 1,148 | Traffic input |
| Impressions | 19,954 | Delivery-volume input |
| Current CPC | $0.82 | $938.91 ÷ 1,148 |
| Link click-through rate | 5.75% | 1,148 ÷ 19,954 |
| $67 base purchases per click | 0.958% | 11 ÷ 1,148 |
| Observed $67 acquisition cost | $85.36 | $938.91 ÷ 11 |

## What ten $199 upgrades requires at the observed rate

At the observed **18.18%** $199 take rate, generating ten daily upgrades requires **55 $67 base purchases**. At the observed click-to-$67 conversion rate, this requires approximately **5,740 link clicks**. Holding current $0.82 CPC and 5.75% link CTR constant, the modeled media requirement is approximately **$4,694.55 in spend** and **99,771 impressions**.

| Daily planning result at observed rate | Modeled value |
|---|---:|
| Target $199 upgrades | 10 |
| Required $67 base purchases | 55 |
| Required link clicks | 5,740 |
| Required impressions | 99,771 |
| Modeled media spend | **$4,694.55** |
| $67 base revenue | $3,685.00 |
| $199 upgrade revenue | $1,990.00 |
| Combined gross revenue | $5,675.00 |
| Revenue ÷ media spend | **1.21x** |

The 1.21x figure is **media-only gross revenue divided by media spend**. It does not include payment fees, refund risk, fulfillment, clinical costs, creative/agency costs, customer-support costs, taxes, or later revenue. It should not be interpreted as profit.

## Break-even answer at current click rate

At the observed $85.36 media cost to acquire one $67 purchase, the model needs at least a **9.22%** $199 upgrade take rate to reach **1.00x gross revenue ÷ media spend**. The observed rate of 18.18% is 8.96 percentage points above that threshold. Put differently, the current $0.82 CPC is below the modeled media-only break-even CPC of **$0.99**, leaving approximately **17.28% CPC headroom** under these same conversion assumptions.

So, **yes—on the observed early cohort and only on a gross-revenue-versus-media-spend basis, the funnel can reach ten daily $199 upgrades while remaining above 1.00x media ROAS at the current click rate.** The much more important caution is that this conclusion rests on only two observed upgrades; it needs more volume before it should drive a budget increase.

## Sensitivity: why take rate is the key lever

The table below holds the observed $0.82 CPC and 0.958% click-to-$67 conversion constant while varying the $199 take rate. It shows why ten upgrades per day is expensive if the early 18.18% rate settles materially lower.

| $199 take rate | $67 purchases needed for 10 upgrades | Modeled media spend | Combined gross revenue | Media-only revenue ÷ spend |
|---:|---:|---:|---:|---:|
| 5% | 200 | $17,071.09 | $15,390.00 | 0.90x |
| 10% | 100 | $8,535.55 | $8,690.00 | 1.02x |
| 15% | 66.7 | $5,690.36 | $6,456.67 | 1.13x |
| **18.18% observed** | **55** | **$4,694.55** | **$5,675.00** | **1.21x** |
| 20% | 50 | $4,267.77 | $5,340.00 | 1.25x |

## Operating interpretation

The working unit economics are currently supported by the measured cohort, but the cohort is too small to claim a stable 18.18% take rate. Treat **9.22%** as the practical gross media break-even floor under the current click and $67-purchase economics. Continue to measure this from Kajabi as:

```text
$199 cleared exact-offer upgrades ÷ $67 cleared exact-offer purchases
```

Keep the $67 base-purchase count and $199 upgrade count separate. Do not substitute Meta-reported purchase value for Kajabi cleared revenue, and do not count a $199 transaction as an incremental upsell unless its offer relationship/checkout design confirms that it sits on top of, rather than replaces, the $67 base purchase.

## Data sources

| Source | Used for | Authority in this analysis |
|---|---|---|
| Kajabi transactions API, exact active $67/$199 offer IDs, Central-time date filter | Cleared orders and revenue | **Source of truth** |
| Meta campaign insights, campaign names containing Agora and Interconnected | Spend, impressions, and link clicks | Delivery input only |
