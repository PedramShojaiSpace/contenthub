# Agora Interconnected Funnel — 30-Day ROAS Review

**Prepared:** August 31, 2026 (CDT)  
**Measurement window:** August 1–30, 2026. August 31 is excluded because it is an incomplete delivery day.  
**Scope:** Campaigns in Meta ad account `1153114224705920` whose campaign name contains both **“Agora”** and **“Interconnected”**. This returned 58 campaign records. The review was read-only: no campaign, budget, ad, audience, landing page, attribution setting, or customer record was changed.

## Executive readout

On Meta-reported purchase value, the selected Agora Interconnected campaigns produced **$34,396.54** of value on **$18,674.46** of spend, for **1.84x ROAS** during August 1–30. That result is not evenly distributed across the month: the strongest six-day period was August 17–22 at **2.97x Meta ROAS**, before a sharp deterioration on August 23 and a subsequent end to recorded paid delivery.

The clearest operational finding is that this was **not primarily a top-of-funnel click problem**. In the last four active days, CTR increased to **6.63%** from **5.58%**, but checkout rate fell to **8.67%** from **11.85%** and purchase rate fell to **4.20%** from **6.85%**. The failure was therefore lower in the funnel—between lead capture, checkout, and purchase—not an immediate lack of attention to the ads.

> **Ad-buyer summary:** “We held spend essentially flat over the last four active days, while click-through improved. But lead efficiency worsened, checkout conversion fell 26.8%, purchase conversion fell 38.7%, and Meta ROAS fell 43.9%. The August 23 day was the acute break: high CTR, weak lead efficiency, and an 80.3% checkout-rate drop versus the August 17–22 baseline. We need to investigate the post-click/checkout path and attribution before we treat this as a targeting or creative-scaling decision.”

## 30-day Meta-reported result

| Metric | August 1–30 result | Calculation / definition |
|---|---:|---|
| Spend | **$18,674.46** | Sum of Meta `spend` for the selected campaign records. |
| Impressions | **423,417** | Sum of Meta campaign-level impressions. |
| Inline link clicks | **24,552** | Sum of Meta `inline_link_clicks`. |
| CTR | **5.80%** | Inline link clicks ÷ impressions. |
| Meta leads | **11,988** | Meta `lead` action count. |
| CPL | **$1.56** | Spend ÷ Meta leads. |
| Meta checkouts | **1,259** | Meta `initiate_checkout` action count. |
| Meta purchases | **516** | Meta `purchase` action count. |
| Meta purchase value | **$34,396.54** | Meta `purchase` action-value total. |
| Cost per Meta purchase | **$36.19** | Spend ÷ Meta purchases. |
| **Meta ROAS** | **1.84x** | Meta purchase value ÷ spend. |

## The pattern across the month

| Window | Spend | Meta leads | CPL | Checkouts | Checkout rate | Purchases | Purchase rate | Meta purchase value | Meta ROAS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Aug 1–16 | $11,182.53 | 7,271 | $1.54 | 782 | 10.76% | 266 | 3.66% | $13,030.54 | 1.17x |
| **Aug 17–22** | **$6,880.07** | **4,451** | **$1.55** | **462** | **10.38%** | **238** | **5.35%** | **$20,401.00** | **2.97x** |
| Aug 23 | $611.86 | 245 | $2.50 | 5 | 2.04% | 5 | 2.04% | $0.00 | 0.00x |
| Aug 24–30 | $0.00 | 21 | $0.00 | 10 | 47.62%* | 7 | 33.33%* | $965.00 | N/M |

\*The Aug 24–30 rate calculations are not decision-useful because Meta reports zero paid delivery in that period. The observed purchases/value are compatible with delayed conversion attribution or reporting after delivery stopped; they should not be used as proof of a no-cost result.

## Where performance broke

The most useful comparable view is the last four active days against the four preceding active days. Spend was nearly unchanged, so this is a clean directional comparison rather than a simple spend-volume effect.

| Metric | Prior active window: Aug 16–19 | Recent active window: Aug 20–23 | Change | Reading |
|---|---:|---:|---:|---|
| Spend | $4,302.46 | $4,280.85 | **-0.5%** | Spend was effectively flat. |
| Impressions | 95,202 | 72,849 | **-23.5%** | Delivery volume fell. |
| Inline-link CTR | 5.58% | 6.63% | **+18.8%** | Attention/click response improved. |
| Leads | 2,861 | 2,525 | **-11.7%** | Less volume despite better CTR. |
| CPL | $1.50 | $1.70 | **+12.7%** | Lead efficiency weakened. |
| Checkouts | 339 | 219 | **-35.4%** | Checkout arrival fell much faster than leads. |
| Checkout rate | 11.85% | 8.67% | **-26.8%** | Clear lower-funnel weakening. |
| Purchases | 196 | 106 | **-45.9%** | Purchase count nearly halved. |
| Purchase rate | 6.85% | 4.20% | **-38.7%** | Lead-to-purchase yield weakened materially. |
| Meta purchase value | $15,325.00 | $8,550.00 | **-44.2%** | Revenue declined despite flat spend. |
| **Meta ROAS** | **3.56x** | **2.00x** | **-43.9%** | Main recent deterioration. |

### The August 23 acute break

Compared with the August 17–22 six-day baseline, August 23 had a **higher 7.02% CTR** but an unfavorable lower-funnel result: **$2.50 CPL** (**+61.6%**), **2.04% checkout rate** (**-80.3%**), and **2.04% purchase rate** (**-61.8%**). Meta recorded **$0.00 purchase value** that day. That makes August 23 the highest-priority diagnostic date.

The evidence supports three conclusions, in order:

1. **Traffic response did not collapse.** CTR was higher on August 23 than the preceding six-day baseline, so a blanket “the creative stopped working” explanation is not sufficient.
2. **Lead quality and/or the path after the opt-in deteriorated.** The checkout drop was disproportionately larger than the lead drop. That can result from a lead-quality shift, a changed landing/thank-you/checkout experience, a sequence failure, a price/offer mismatch, or a measurement break. The aggregate report alone cannot distinguish among those causes.
3. **The last week is not a normal operating comparison.** Paid spend is recorded as zero from August 24 onward. Any post-pause conversions must be treated as lagged/reporting effects unless reconciled against first-party order time and attribution keys.

## First-party control: Kajabi-confirmed revenue

The Content Hub’s current first-party purchase table confirms **98 Interconnected purchases**, **$8,482.00** in revenue, tagged `is_meta_attributed=1` and excluding email-list buyers, for the August 1–30 period. Against the same **$18,674.46** of selected Agora campaign spend, that is **0.45x first-party confirmed ROAS**.

| First-party measure | Result | Important qualification |
|---|---:|---|
| Meta-attributed Interconnected Kajabi purchases | 98 | Email-matched to an Interconnected lead; excludes email-list buyers. |
| Confirmed Kajabi revenue | $8,482.00 | Captured first-party revenue, not Meta’s reported action-value total. |
| Confirmed-first-party ROAS | 0.45x | $8,482.00 ÷ $18,674.46. |
| First-party purchases Aug 17–22 | 83 / $7,013.00 | Most confirmed first-party result occurred in the strong Meta period. |
| First-party purchases Aug 23–30 | 0 / $0.00 | Requires diagnostic follow-up; it may reflect no sales, data latency, missed webhook capture, or an attribution/funnel break. |

This control is intentionally **not presented as a strict Agora campaign-level ROAS**: the first-party purchase table identifies Interconnected and Meta attribution at the lead/email level but does not yet preserve enough campaign-level data to isolate every order to one of the 58 specific Agora campaigns. The large difference between Meta-reported **1.84x** and first-party confirmed **0.45x** is a measurement discrepancy that should be reconciled before scaling.

## What to ask the ad buyer now

1. **Confirm the pause timeline.** Why does Meta show $0.00 delivery from August 24 onward? Identify every campaign/ad-set status or budget change made on August 22–24, including the 90 unpublished drafts visible in Ads Manager. Do not publish drafts as part of this review.
2. **Audit the August 23 destination path.** Compare the exact destination URL, UTM/Meta parameters, opt-in form, thank-you page, $67 checkout handoff, and Kajabi Day 0 automation against August 17–22. Check logs and page status rather than assuming the issue is targeting.
3. **Verify attribution definitions.** Export the Meta purchase action/value attribution setting, conversion window, event source, and deduplication view for the selected campaign family. Reconcile the 516 Meta purchases / $34,396.54 with 98 first-party email-matched purchases / $8,482.00.
4. **Break out August 20–23 by campaign and ad set.** Find whether the higher CTR was concentrated in a new lead-optimized campaign, a different destination, a fresh creative, or a changed audience. The overall aggregate cannot identify a single culprit.
5. **Use a guarded restart only after the diagnostic.** If paid delivery is restarted, change one variable at a time, preserve the known-good destination path, and hold the campaign unchanged for the agreed evidence window. Any budget or activation decision needs a separate owner approval.

## Basis, sources, and confidence

**Basis.** “Meta ROAS” is Meta purchase action value ÷ Meta spend. “First-party confirmed ROAS” is Kajabi revenue for Interconnected, Meta-attributed, non-email-list purchases ÷ the same selected Meta spend. Rates are recomputed from aggregate values and rounded only in presentation.

**Time.** The report was generated August 31, 2026, for August 1–30, 2026.

**Sources.** A read-only Graph API pull from Meta ad account `1153114224705920` at campaign level, selecting names containing both “Agora” and “Interconnected”; and the Content Hub `kajabi_purchases` table filtered as described above.[1] [2]

**Confidence.** High for Meta’s selected-campaign delivery/action totals as of the report pull. Moderate for underlying economic interpretation because Meta action-value revenue and first-party confirmed revenue diverge materially, and the first-party dataset is not yet strict campaign-level for all Agora records. The inference that the August 23 issue was lower-funnel rather than click response is supported by the rate pattern, but its root cause remains unproven until the destination/automation/attribution audit is complete.

## References

[1]: `scripts/report-agora-meta-readonly.mjs` — read-only Meta Graph API report collector; no POST, write, or campaign-change call.

[2]: `scripts/analyze-agora-roas-2026-08.mjs` and the August 31, 2026 aggregate query against `kajabi_purchases` — calculation lineage for the comparison windows and first-party control.
