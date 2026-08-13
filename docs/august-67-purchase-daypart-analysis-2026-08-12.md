# August $67 Purchase Timing Analysis — 2026-08-12

## Data Basis

This analysis uses the direct Kajabi Transactions API as the sales source of truth because the new Shopify/Klaviyo checkout path had not yet received traffic. It includes 45 successful, non-refunded $67 transactions from August 1 through August 12, 2026, normalized to Central Time. The direct Shopify audit returned no matching $67 transactions for the new Shopify product title, which is expected before the Klaviyo/Shopify path starts receiving buyers.

The three recent $67 sales reported by the owner were confirmed at **6:21 PM, 6:34 PM, and 6:52 PM CT** on August 12. A fourth $67 sale occurred at 7:57 AM CT that day.

## Purchase Timing

| Central Time daypart | $67 sales | Share of 45 sales | Unique Interconnected leads | Share of 1,372 leads |
|---|---:|---:|---:|---:|
| Overnight, 12 AM–5:59 AM | 4 | 8.9% | 196 | 14.3% |
| Morning, 6 AM–11:59 AM | 21 | 46.7% | 376 | 27.4% |
| Afternoon, 12 PM–4:59 PM | 8 | 17.8% | 262 | 19.1% |
| Evening, 5 PM–10:59 PM | 11 | 24.4% | 496 | 36.2% |
| Late evening, 11 PM–11:59 PM | 1 | 2.2% | 42 | 3.1% |

## Ad-Delivery Context

Meta’s account timezone is **America/Los_Angeles**. For Agora campaign/ad-set names only, the available hourly delivery report shows $2,319.97 of August 1–12 spend in the account’s 12 AM–6:59 AM buckets, which corresponds to approximately **2 AM–8:59 AM CT**. This report shows no direct Agora spend in the account’s 5 PM–10:59 PM buckets. Evening purchases therefore occur despite little or no contemporaneous evening delivery in this report; they may reflect delayed consideration, email exposure, prior clicks, or time-zone/delivery-report constraints rather than an ad-delivery advantage.

## Interpretation

The current three-sale evening cluster is real but is not yet a sufficient basis to move the main acquisition budget into evenings. Over the month so far, evening has **24.4% of purchases versus 36.2% of leads**, while morning has **46.7% of purchases versus 27.4% of leads**. This makes the stronger preliminary signal a morning purchase over-index, not an evening one.

Purchase timestamp is not the same as the time an ad was seen or clicked. Restricting main prospecting delivery based only on checkout hour could reduce the lead flow that later converts through the 14-day email sequence.

## Recommended Test

1. Keep main Agora prospecting delivery unchanged for the next seven days; do not daypart the core budget yet.
2. Add a controlled evening **retargeting or conversion-reminder** test only, limited to 5 PM–9 PM CT and aimed at existing leads/checkout starters rather than cold acquisition.
3. Continue recording purchase hour, click time, lead time, closing email/SMS touch, and original acquisition cohort. Evaluate at least 30 additional $67 purchases before reallocating core acquisition budget.
4. Use confirmed paid purchases and revenue per eligible lead as the decision metric, not checkout starts alone.
