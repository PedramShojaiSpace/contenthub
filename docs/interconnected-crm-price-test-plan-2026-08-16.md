# Interconnected CRM-Path and Entry-Price Experiment Plan

## Decision

Run the experiment **in sequence, not all at once**. First determine whether the **Kajabi** or **KO/Klaviyo** path produces better 14-day economics while both sell the same $67 all-access product. Only after that CRM-path decision is mature should the winning path test **$49, $67, and $99**. The $199 one-click offer remains unchanged throughout.

This ordering is the cleanest way to reduce the number of pages and avoid an uninterpretable result. A simultaneous CRM-by-price design would create six cells, fragment early traffic, and make it impossible to determine whether a difference came from the CRM, checkout, price, or their interaction.

> **Operating rule:** one meaningful variable per decision window. Hold the offer contents, page structure, video, $199 offer, audience, campaign mix, and creative constant while measuring the assigned variable.

## Current Readiness

| Item | Verified current state | Implication |
| --- | --- | --- |
| CRM paths | The reporting model has separate `kajabi` and `ko_klaviyo` paths and explicitly forbids pooled winner metrics. | The CRM experiment is feasible only with sticky assignment at opt-in. |
| Checkout paths | The Day 0 pages already direct Kajabi traffic to Kajabi checkout and KO/Klaviyo traffic to Shopify checkout, with path-specific UTMs and `funnel_path` fields. | Preserve this separation; do not swap either checkout destination. |
| Current $67 offer | The contextual Day 0 offer renders a $67 all-access invitation and fires InitiateCheckout with value 67. | Use $67 as the CRM-test control price. |
| Current CRM samples | Since August 1, the database contains 140 new `kajabi`-assigned leads and no `ko_klaviyo`-assigned leads; 2,200 earlier leads are unbucketed and must remain excluded from a winner decision. | Do not compare CRM paths until KO/Klaviyo receives randomized traffic. |
| $199 offer | The downstream one-click offer is already an important economic lever. | Keep price, page, and eligibility unchanged in both tests. |

The first three items are implemented in the current attribution and Day 0 offer contracts.[1](../server/interconnectedEmailRevenueRouter.ts) [2](../server/interconnectedDayZeroOfferStaticPage.ts)

## Stage 0 — Instrumentation and Freeze

Before sending test traffic, create a durable experiment record for each new lead and propagate it through every subsequent event. Use **one assignment at opt-in** and do not reassign a visitor later.

| Field | CRM-path experiment | Price experiment |
| --- | --- | --- |
| `experiment_id` | `ic_crm_path_v1` | `ic_entry_price_v1` |
| `crm_path` | `kajabi` or `ko_klaviyo` | Fixed to CRM winner |
| `price_cell` | `67` | `49`, `67`, or `99` |
| `checkout_platform` | `kajabi` or `shopify` | Fixed to CRM winner |
| Required on | Lead, thank-you exposure, offer-page view, checkout touch, paid order, $199 offer view, $199 purchase/refund | Same |

All email and SMS links must preserve the original assignment. A person assigned to `ko_klaviyo` must never be shown a Kajabi link, and a person assigned to a price cell must never see a different price in a later Day 0 email, reminder, or checkout return visit. Existing route-level UTM and `funnel_path` safeguards are the correct base; the experiment and price fields should be additive rather than replacing them.[2](../server/interconnectedDayZeroOfferStaticPage.ts)

## Stage 1 — CRM Path: Kajabi vs. KO/Klaviyo

Randomize eligible new opt-ins 50/50 at the form submission point. Serve the same $67 all-access product, the same thank-you offer content, and the same $199 one-click offer. The only intended differences are the CRM sequence and the channel-native checkout path.

| Element | Kajabi cell | KO/Klaviyo cell | Must remain identical |
| --- | --- | --- | --- |
| Assignment | Sticky `kajabi` | Sticky `ko_klaviyo` | 50/50 randomized allocation |
| $67 checkout | Kajabi $67 checkout | Shopify $67 cart/checkout | Price, product, offer contents, CTA copy |
| Follow-up system | Kajabi sequence | Klaviyo email/SMS sequence | Cadence, topic, and offer timing as closely as operationally possible |
| Revenue reporting | Kajabi-native imported metrics | Klaviyo snapshot plus Shopify attribution | No pooled reporting or cross-attribution |

The **primary outcome** is **realized 14-day revenue per assigned lead**, separately by path:

`RPL14 = (paid $67 revenue + paid $199 revenue − refunds) ÷ assigned leads`

Use direct $67 conversion, $199 attach rate, refund rate, email/SMS engagement, checkout-start rate, and time-to-purchase as diagnostic metrics—not as the winner by themselves. The winning path is the one with the superior mature RPL14 and no material attribution-quality problem.

Do not call a winner before both conditions are met:

1. Every analyzed lead has had a full **14-day** observation window; and
2. Each path has at least **1,000 assigned leads or 20 paid $67 orders**, whichever happens later.

If traffic or order volume cannot meet that threshold in 30 days, report a directional result, retain the $67 control, and decide whether the next action is more traffic or a formal power calculation using observed conversion rates. Do not promote a path simply because it wins on open rate, click rate, or early revenue.

## Stage 2 — Entry Price: $49 vs. $67 vs. $99

After selecting the CRM winner, freeze the CRM and checkout platform. Then randomize only within that winning path into three sticky price cells: $49, $67, and $99. This is the moment to create price-specific offer-page and checkout destinations—but not before. The $199 one-click offer remains **$199** in all three cells.

| Price cell | Product and downstream offer | Required checkout treatment |
| --- | --- | --- |
| $49 | Same all-access bundle; $199 unchanged | A dedicated, price-correct checkout SKU or offer with `price_cell=49` |
| $67 | Same current control bundle; $199 unchanged | Current winning-path checkout with `price_cell=67` |
| $99 | Same all-access bundle; $199 unchanged | A dedicated, price-correct checkout SKU or offer with `price_cell=99` |

Keep the page copy and order of proof identical other than price-dependent language. Do not use different bonuses, urgency, checkout designs, discount codes, or email frequency by price; otherwise the test becomes a package or presentation test rather than a price test.

### Break-even conversion requirements

The price test must be judged on **revenue per assigned lead**, not gross conversion. The table below shows how much entry conversion can fall or rise relative to the $67 control before the cell loses revenue, assuming identical $199 attach behavior.

| $199 attach-rate assumption | $49 needs this much more entry conversion than $67 to tie | $99 may accept this much less entry conversion than $67 and still tie |
| --- | ---: | ---: |
| 0% | 36.7% more | 32.3% less |
| 10% | 26.1% more | 26.9% less |
| 20% | 20.3% more | 23.1% less |

The math is based on expected early revenue per buyer: `entry price + ($199 × attach rate)`. It deliberately keeps the $199 price fixed. Actual winner selection still uses paid, net, 14-day revenue after refunds.

For the price test, do not call a winner before each price has at least **1,000 assigned leads or 20 paid entry orders**, whichever happens later, and every analyzed lead has matured for 14 days. A price must beat $67 on net RPL14 by a precommitted practical margin—for example, **10% or more**—without a material deterioration in $199 attach rate, refunds, or payment completion. If no price clears that bar, retain $67.

## Analytics Dashboard Requirements

The existing Email → Revenue view must retain its fully separate Kajabi and KO/Klaviyo columns during Stage 1. Add an experiment view only after the CRM winner is selected, with a separate filter for `experiment_id` and `price_cell`; do not use the existing all-path aggregate as a winner dashboard.

| Metric | CRM test view | Price test view |
| --- | --- | --- |
| Assigned leads | By `crm_path` | By price cell within the winning CRM path |
| Qualified $67 orders | By path | By price cell |
| $199 purchases and attach rate | By original CRM path | By original price cell |
| Refunds and net revenue | By original CRM path | By original price cell |
| RPL14 | Winner metric by path | Winner metric by price |
| Ad spend / ROAS | Only if spend is attributed to the same experiment slice | Same; never pool untagged spend |

## Recommended Order and Approval Gates

| Sequence | Action | Approval gate |
| --- | --- | --- |
| 1 | Finish QA for the KO/Klaviyo registration, email/SMS, Shopify $67 checkout, and path labels. | Approve launch of the 50/50 CRM-path test. |
| 2 | Run Kajabi vs. KO/Klaviyo at $67 only; freeze all other meaningful funnel changes. | Approve CRM winner after mature RPL14 review. |
| 3 | Build three price-specific but otherwise identical pages/checkout destinations in the winning path, keeping the $199 offer at $199. | Approve $49/$67/$99 launch. |
| 4 | Run the three-cell price test with sticky pricing and 14-day maturity. | Approve the winning price or retain $67. |
| 5 | Only after the winner is locked, resume CRO work on page copy, offer presentation, or upsell optimization. | Separate approval for each new variable. |

## Recommendation

**Yes—wait until the CRM-path test is decided before building the $49 and $99 variants.** That is the more disciplined choice. It creates fewer pages, protects attribution, and ensures the eventual price result is a price decision rather than a hidden CRM or checkout decision. Until the KO/Klaviyo path is live and randomized, the current 140 newly bucketed Kajabi leads do not constitute a CRM comparison; earlier unbucketed leads should stay out of the winner calculation.

No live page, checkout, CRM flow, price, or ad setting has been changed by this planning work.

## References

[1] [Interconnected Email → Revenue attribution contract](../server/interconnectedEmailRevenueRouter.ts)

[2] [Channel-specific Day 0 offer and checkout routing](../server/interconnectedDayZeroOfferStaticPage.ts)
