# Interconnected Thank You Video Split Conclusion — 2026-08-12

## Decision

The internal Thank You A/B test has been concluded with **Version B — New Script Video** selected as the operating Kajabi control. The standard `/interconnected/thank-you` route now renders Version B directly; it no longer assigns visitors through the internal A/B splitter. The former A page remains accessible only at its explicit legacy URL and is no longer part of standard routing.

## Recorded Test Evidence

| Variant | Page / video | Unique exposures | Checkout starts | Checkout-start rate | Recorded purchases |
|---|---|---:|---:|---:|---:|
| Version A — Original Video | Legacy A page / Wistia `hobj7srg3q` | 72 | 7 | 9.7% | 0 |
| Version B — New Script Video | Current B page / Wistia `10cdtpm3il` | 47 | 5 | 10.6% | 0 |

The test did not reach its configured 200-exposure-per-variant threshold and has no recorded purchases, so this is **not a statistical declaration of superiority**. Version B was selected as the operational champion at the owner’s direction because it is the preferred page and its observed checkout-start rate is directionally higher. This creates one stable Kajabi control for the next Klaviyo-versus-Kajabi comparison.

## Page and Tracking Changes

1. The redundant final CTA on Version B was removed; the footer now follows the FAQ.
2. `/interconnected/thank-you` now maps directly to Version B. This stops new A/B assignments and preserves the original test history in the database as concluded with Version B selected.
3. `/interconnected/thank-you-klaviyo` remains the distinct Klaviyo treatment path with its own tracked Shopify checkout and desktop-only exit-intent recovery.
4. The comparison should use confirmed paid orders, checkout-to-paid rate, revenue per eligible lead, and 14-day cohort revenue. Do not treat the historical internal checkout-start difference as a paid-revenue winner.
