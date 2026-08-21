# Shopify Orobiome Page-Speed Comparison

## Scope

This read-only comparison measures the live Natalie Jill Orobiome route against the original published Orobiome advertorial under matched Lighthouse synthetic conditions. No Shopify page, theme, offer, checkout, or affiliate setting was changed during measurement.

> **Interpretation note:** These are single-run synthetic results. They are best used directionally; CDN routing, third-party services, and transient network conditions can move individual metrics between runs.

## Mobile

| Metric | Natalie Jill page | Original advertorial | Difference (new − original) |
|---|---:|---:|---:|
| Performance score | 59 | 30 | +29 points |
| First Contentful Paint | 2.26 s | 6.97 s | -4713 ms |
| Largest Contentful Paint | 2.83 s | 11.58 s | -8749 ms |
| Speed Index | 8.01 s | 9.28 s | -1268 ms |
| Total Blocking Time | 1707 ms | 1638 ms | +69 ms |
| Cumulative Layout Shift | 0.008 | 0.05 | -0.042 |
| Page weight | 2774 KiB | 3545 KiB | -789874 bytes |
| Network requests | 198 | 199 | -1 |

**Mobile reading:** The new page is better on LCP and better on first contentful paint relative to the original in this matched run.

## Desktop

| Metric | Natalie Jill page | Original advertorial | Difference (new − original) |
|---|---:|---:|---:|
| Performance score | 57 | 76 | -19 points |
| First Contentful Paint | 1.42 s | 1.24 s | +187 ms |
| Largest Contentful Paint | 1.71 s | 2.17 s | -464 ms |
| Speed Index | 3.52 s | 3.30 s | +220 ms |
| Total Blocking Time | 191 ms | 128 ms | +63 ms |
| Cumulative Layout Shift | 0.369 | 0 | +0.369 |
| Page weight | 2766 KiB | 3078 KiB | -320208 bytes |
| Network requests | 201 | 164 | +37 |

**Desktop reading:** The new page is better on LCP and slower on first contentful paint relative to the original in this matched run.

## Non-Invasive Recommendations

1. Prioritize the hero image and any above-the-fold media for size and format review; that is the most likely source of LCP variation between two Shopify landing pages.
2. Preserve the native Shopify cart CTA and BixGrow parameter while testing asset changes so affiliate attribution remains intact.
3. Re-run this paired audit after any hero-media or third-party-script change; compare like-for-like runs rather than a single isolated score.
4. Do not remove required Shopify, affiliate, or checkout scripts solely to raise a synthetic score without validating attribution and purchase behavior.

## Methodology

| Condition | Setting |
|---|---|
| New route | https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds |
| Original route | https://shop.theurbanmonk.com/pages/orobiome-advertorial |
| Mobile condition | Lighthouse default mobile configuration |
| Desktop condition | Lighthouse desktop preset |
| Audit engine | Lighthouse 13.4.1 |

