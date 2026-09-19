# Agora-to-KO Sales Split-Test Recommendation

**Prepared by:** Manus AI  
**Checked:** September 18, 2026  
**Purpose:** Select one existing Agora sales campaign as the control for a clean Kajabi-versus-Unbounce/Klaviyo/Shopify test. No campaign, ad set, ad, budget, destination, or traffic setting was changed while preparing this recommendation.

## Recommendation

Use the **Healthy Habits** sales campaign as the test control. The challenger should be an exact duplicate that changes only the destination from the existing Kajabi screening path to the approved KO path:

`https://try.theurbanmonk.com/interconnected-lp-3/`

The selected control is campaign **52590299920405**, named **“CM - Top - Interconnected Agora Funnel - MAX VALUE PURCHASE … Top - Healthy Habits (website) … Exclude Warm Market.”** Its live ad set is **52590299928405** and its active delivery is concentrated in ad **52590299928605**, **“1CONTROL Interconnected Image.”** The campaign is an **OUTCOME_SALES** campaign with a **VALUE** optimization goal and a current campaign budget of **$55 per day**.

This is the most reliable current control because it produced the best aggregate restart-window cost per Meta Purchase among the four active Agora sales campaigns, while also carrying the largest volume of the group. Its apparent winner status is a **Meta optimization signal**, not a revenue verdict. The revenue winner must be decided from cleared Kajabi and Shopify records, not the pixel’s reported purchase value.[1] [2]

## Current Sales-Campaign Ranking

The table uses Meta’s September 16–18 reporting window. Meta reports this account in Pacific time. September 18 was still in progress when the review was run, so these are **early restart indicators**, not final performance results.

| Rank | Audience / campaign | Spend | Meta Purchase events | Cost per Meta Purchase | Meta leads | CPL | Decision |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | **Healthy Habits (website)** — campaign 52590299920405 | $227.85 | 15 | **$15.19** | 113 | $2.02 | **Use as control** |
| 2 | Organic Product, high-net-worth — campaign 52590299920805 | $242.71 | 13 | $18.67 | 94 | $2.58 | Keep as a separate live audience; do not use as the first destination-test control |
| 3 | Health & Wellness — campaign 52590299921205 | $194.38 | 10 | $19.44 | 87 | $2.23 | Do not duplicate first |
| 4 | Natural Foods — campaign 52590299921005 | $201.19 | 9 | $22.35 | 86 | $2.34 | Do not duplicate first |
| **Total** | Four active Agora sales campaigns | **$866.13** | **47** | **$18.43** | **380** | **$2.28** | Context only |

The winning control’s delivery is not distributed across several comparable creatives. The **1CONTROL Interconnected Image** received **$208.06 of $227.85 spend (91.31%)** and generated **13 of 15** reported Purchase events. The “Trailer with Bushel Behind Video REEL FORMAT” had an attractive $6.45 reported cost per Purchase but only $12.89 of spend and two events; that is too little evidence to substitute for the control image.

## The Test Must Hold Everything Else Constant

This should be a **destination-path test**, not an uncontrolled campaign refresh. The test pair needs the following fixed items:

| Element | Kajabi control | KO challenger | Rule |
|---|---|---|---|
| Objective | Sales | Sales | Same Meta objective |
| Optimization | Value / Purchase | Value / Purchase | Match the source ad set exactly |
| Audience | Healthy Habits (website), March 2025, excluding warm market | Exact duplicate | No audience change |
| Creative | 1CONTROL Interconnected Image | Exact duplicate | No copy, image, placement, or creative change |
| Budget | Equal daily budget | Equal daily budget | The existing source budget is $55/day; a one-for-one test pair would therefore require $55/day per arm unless a lower total test budget is deliberately approved |
| Destination | Existing Kajabi screening route | `https://try.theurbanmonk.com/interconnected-lp-3/` | This is the sole substantive experience variable |
| Pixel | Urban Monk pixel `1498608757116877` | Same pixel | Already verified on LP-3 and Shopify |
| Lead event | Existing Kajabi lead flow | Browser Pixel Lead + deduplicated Meta CAPI Lead | Both arms must produce exactly one Lead per form completion |
| Revenue authority | Paid, non-refunded Kajabi offers | Paid, non-refunded Shopify product 9087631753370 | Never use Meta purchase value as revenue |

The cleanest implementation is Meta’s **A/B Test / Experiments** workflow with the Healthy Habits campaign as the control and its destination-only duplicate as the challenger. This is preferable to simply turning on two overlapping clones because Meta can randomize the eligible audience between the two arms. The three other active audience campaigns can continue, but neither of the two test arms should receive a creative, audience, optimization, or budget change during the test.

## Required Naming and URL Contract

The challenger’s campaign **and ad set** should contain the exact phrase **`Interconnected KO`**. That routes KO spend into the dedicated Content Hub reconciliation ledger rather than mixing it with Agora.[2]

Use distinctive campaign and UTM labels so every lead and purchase can be assigned to one test arm without relying on Meta’s modeled attribution:

| Test field | Kajabi control | KO challenger |
|---|---|---|
| Campaign name suffix | `IC-Destination-Test-Kajabi-Control-v1` | `Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1` |
| `utm_source` | `meta` | `meta` |
| `utm_medium` | `paid_social` | `paid_social` |
| `utm_campaign` | `ic_destination_test_kajabi_control_v1` | `ic_destination_test_ko_shopify_challenger_v1` |
| `utm_content` | `healthy_habits_control_image_v1` | `healthy_habits_control_image_v1` |

The KO destination should retain the approved LP-3 native-form script. It records the UTM campaign and content values, sends one browser Lead with the Urban Monk pixel, and gives the same event ID to the server-side Meta CAPI event for deduplication. The dedicated KO ledger then separates first-party KO leads and Shopify revenue from Agora/Kajabi totals.[2]

## Scorecard: How the Winner Is Actually Decided

> **A Meta Purchase event is useful for delivery optimization. It is not the test’s revenue authority.** The outcome must be calculated from first-party lead records and paid, non-refunded checkout records.

Each arm should have its own cohort report, built from leads who entered during the test window. The test team should compare both arms at the same maturity level.

| Metric | Control source | Challenger source | Decision use |
|---|---|---|---|
| Delivered spend | Meta campaign insights | Meta campaign insights | Cost denominator |
| Unique qualified leads | First-party Agora lead record | First-party `ko_klaviyo` lead record | Counts the actual denominator once |
| $67 entry buyers | Kajabi cleared, paid, non-refunded orders | Shopify paid, non-refunded product orders | Primary conversion outcome |
| $199/other downstream buyers | Kajabi cleared orders | Shopify paid, non-refunded relevant order records | Follow-on outcome |
| 14-day booked revenue per lead | Cohort-attributed Kajabi revenue | Cohort-attributed Shopify revenue | Primary winner metric |
| 14-day booked ROAS | Cohort revenue ÷ Meta spend | Cohort revenue ÷ Meta spend | Commercial winner metric |
| Lead-to-$67 conversion | $67 entry buyers ÷ unique leads | $67 entry buyers ÷ unique leads | Funnel-health diagnostic |
| Immediate upsell take rate | Upsell buyers ÷ $67 buyers | Upsell buyers ÷ $67 buyers | Offer-quality diagnostic |

The initial reading should happen only after **at least 250 unique first-time leads per arm**. This is an instrumentation and directional check, not a final declaration. The commercial decision should wait until the final enrolled lead in each arm has had **14 full days** to mature, because the offer includes later email and upsell behavior. If the two arms remain close after that maturity window, continue until each arm has at least **500 qualified leads** rather than calling a winner from a few pixel events.

A practical win rule is: select the arm with the higher **14-day booked revenue per qualified lead** and **14-day booked ROAS**, provided the result is not driven by unmatched, refunded, or non-funnel orders. If the challenger produces a higher entry conversion but lower 14-day revenue per lead, the control remains commercially superior.

## Pre-Launch Checklist for the Ad Buyer

1. Duplicate only campaign **52590299920405** and retain the Healthy Habits audience, value optimization, placements, image creative, copy, and budget settings.
2. Preserve the original Kajabi destination as the control. Change the challenger destination only to the LP-3 URL above.
3. Apply the two exact naming and UTM contracts in the table. Include **`Interconnected KO`** in the challenger campaign and ad-set name.
4. Create the pair through Meta Experiments as a destination-only A/B test. Do not place the second, third, or fourth ranked campaigns into this test.
5. Before publishing, open each destination in an incognito/private session with its test UTM string. Confirm the Kajabi route opens for the control, and LP-3 opens for the challenger.
6. Submit one approved email-only QA lead through the challenger only if a fresh QA approval is given. Confirm one Lead event, one CAPI event, Klaviyo enrollment, the Klaviyo thank-you page, and the Shopify handoff. Do not create a paid test order without separate approval.
7. Start the test only after the first-party reconciliation view shows the two campaign labels separately. Review delivery daily, but do not declare a revenue winner until the defined cohort maturity window closes.

## What Has Not Been Changed

No ad, budget, destination, lead form, pixel, CAPI configuration, Kajabi offer, Shopify product, Klaviyo flow, consent setting, checkout, traffic allocation, or experiment was created or changed during this analysis. The next operational action is an approval to create the destination-only Meta A/B test with the stated **$55/day-per-arm** budget choice, or an alternative explicitly approved total test budget.

## References

[1]: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=10207858653523297 "Meta Ads Manager — Urban Monk ad account"

[2]: https://content.theurbanmonk.com/hub/analytics/reconciliation "Urban Monk Content Hub Sales Reconciliation"
