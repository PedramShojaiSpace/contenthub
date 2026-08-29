# Interconnected Agora — Pre-Pause Review and Restart Guardrails

**Scope:** Agora-only Interconnected reconciliation. VIBE, DSS, Tantra, and every other campaign family are excluded. This is a read-only pre-restart review; no campaign, budget, landing page, checkout, form, or tracking behavior changed.

> **Decision support only:** This is operational analysis, not a guarantee of advertising performance. The final go/no-go and budget decisions remain with the owner and ad-buying team.

## Last Recorded Agora-Only Daily Snapshots

The most recent stored daily Agora snapshot is August 22, 2026. The immediately prior healthy daily comparison point is August 20, 2026. Both snapshots use the reconciled `interconnected_agora` cohort and direct Kajabi purchase value in the Content Hub database.

| Metric | Aug. 20 (healthy comparison) | Aug. 22 (last recorded / weak) | Change |
|---|---:|---:|---:|
| Agora spend | $522.03 | $704.68 | +35% |
| First-party lead count | 319 | 305 | -4% |
| Cost per lead | $1.64 | $2.31 | +41% |
| Checkout starts | 40 | 13 | -68% |
| Lead → checkout rate | 12.54% | 4.26% | -8.28 percentage points |
| Direct Kajabi purchases | 21 | 3 | -86% |
| Lead → purchase rate | 6.58% | 0.98% | -5.60 percentage points |
| Direct Kajabi revenue | $2,267.00 | $201.00 | -91% |
| Direct Kajabi ROAS | 4.34× | 0.29× | -94% |

The August 22 revenue is exactly three $67 purchases and does not show the stronger blended revenue per buyer present in the August 20 snapshot. The data therefore shows deterioration below the opt-in: CPL rose modestly, but lead-to-checkout and lead-to-purchase conversion collapsed.

## Customer-Path Verification

| Step | URL | Read-only result |
|---|---|---|
| Live Meta acquisition page | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` | Public landing page and registration form render. No test lead was submitted. |
| Thank You B | `https://content.theurbanmonk.com/interconnected/thank-you-b` | Public page renders with its offer controls. |
| Exact $67 Kajabi handoff | `https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout` | Public checkout renders the Interconnected: The Complete Healing Protocol at $67. No payment details were entered and no order was created. |

The last controlled end-to-end test recorded before the present review already confirmed that the Kajabi registration form directed correctly into Thank You B and that the checkout loaded. Today's check reconfirms that all three customer-facing surfaces are presently reachable. It does not create a fresh lead, payment, or purchase.

## What the Evidence Supports—and Does Not

The available data does **not** support a conclusion that a currently broken landing-page, thank-you page, or checkout created the decline. All surfaces are live. It does support the conclusion that the August 22 cohort was materially less likely to advance after opt-in, with sharply weaker checkout and purchase rates. Potential contributors may include traffic quality, audience/creative fatigue, offer-match changes, on-page experience, or incomplete attribution; these cannot be separated conclusively from this snapshot alone.

The Thank You B page currently includes ratings and testimonial-style claims. They were not used in this analysis and have not been verified from the code review. Before scaling spend, ensure every rating, quote, and health-related marketing statement used on customer pages has an approved, substantiated source. Do not use invented or unverified customer testimonials.

## Cautious Restart Guardrails

1. **Start with one existing, previously used Agora Interconnected campaign only.** Do not create new campaigns or copy changes during the first read.
2. **Use a limited daily cap of about $187–$234**, equal to 20–25% of the most recently reported $934.94 daily Agora spend. Do not raise it on the first day.
3. **Use first-party outcomes, not raw Meta lead count, as the decision frame:** unique lead count, checkout starts, direct Kajabi $67 purchases, direct Kajabi revenue, and any separately confirmed $199 OCUS purchases.
4. **Hold the entry price and landing/thank-you path constant** for this first restart. Avoid combining a traffic restart with a $49/$99 price test or page change; otherwise the signal cannot be interpreted.
5. **Review after the first 100 unique first-party registrations or 48 hours, whichever comes later.** At the weak-period $2.31 CPL, a $67 front-end requires roughly 3.00% entry conversion to break even without an upsell. With a 15% $199 OCUS assumption, expected revenue per entry buyer is $96.85 and break-even entry conversion is roughly 2.00%.
6. **Do not scale on opt-ins alone.** The weak day had a near-normal lead volume but 0.98% purchase conversion and 0.29× direct Kajabi ROAS. Require checkout and paid-order recovery before increasing the cap.

## Practical Instruction for the Ad Buyer

> Reactivate only one known Agora Interconnected campaign at a limited daily cap. Keep its existing destination and creative unchanged for the first 48 hours. Do not add VIBE, DSS, Tantra, price tests, or new creatives to this read. Watch unique first-party leads, checkout starts, direct Kajabi $67 purchases, direct Kajabi revenue, and separately tracked $199 OCUS purchases. Hold or reduce if the first 100 unique leads do not produce at least three $67 entries without OCUS, or at least two entry buyers when a validated 15% $199 OCUS rate is included. Scale only after this signal is verified.
