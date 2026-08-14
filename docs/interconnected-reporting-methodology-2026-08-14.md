# Interconnected Reporting Methodology — 14 August 2026

## Purpose

This note records the corrected methodology used by the Interconnected reconciliation dashboard so the daily revenue, ROAS, and attribution figures can be interpreted consistently for spend decisions.

## Corrected calculation basis

| Metric | Definition | Reporting treatment |
|---|---|---|
| **Recorded Revenue ROAS** | Eligible paid Kajabi transactions plus mapped Shopify paid orders in the selected date range, divided by Agora-only Meta spend | Primary same-day operating metric |
| **Lead-matched lower bound** | Recorded purchases whose buyer email is matched to a tracked Interconnected Meta/Manus lead, divided by the same Agora-only spend | Conservative attribution cross-check; it can understate valid revenue while matching is incomplete |
| **Date boundary** | 12:00 AM through 11:59:59 PM in `America/Chicago` | Applied to database purchases, lead cohorts, and dashboard date presets |
| **Meta spend** | Meta Insights rows whose campaign or ad-set name contains the registered `agora` keyword | Excludes non-Agora campaigns |

## Verified 13 August 2026 result

The corrected authenticated reconciliation endpoint returned the following in the Central-time reporting window:

| Input | Result |
|---|---:|
| Agora-only Meta spend | **$656.56** |
| Recorded Kajabi revenue | **$1,269.00** |
| Recorded purchases | **15** |
| $67 bundle purchases | **13** / **$871.00** |
| $199 OCUS purchases | **2** / **$398.00** |
| Recorded Revenue ROAS | **1.93x** |
| Lead-matched revenue | **$1,135.00** |
| Lead-matched purchases | **13** |
| Lead-matched lower-bound ROAS | **1.73x** |

> The prior $335 / 0.61x view was a partial historical result. It was not a safe spend-decision number once later Kajabi transactions, including the $199 OCUS purchases, were present. The dashboard now labels its figures by measurement basis rather than calling the all-revenue figure “True ROAS.”

## Controls added

The dashboard now computes browser date presets in Central time, applies Central-time boundaries to database purchase and lead-cohort queries, labels the primary metric **Recorded Revenue ROAS**, and shows the conservative lead-matched lower bound separately. Focused regression tests cover daylight-saving-aware Central date boundaries and mapped Shopify line-item reconciliation.
