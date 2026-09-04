# Agora Funnel: Conservative Blended First-Party ROAS

**Prepared:** September 4, 2026  
**Status:** Read-only operating analysis; no advertising change was made.  
**Measurement rule:** Kajabi is the authority for the $67 entry offer and $199 one-click-upgrade revenue. Shopify is included only where a buyer email was privately matched to a verified post–August 1 Agora lead. Meta contributes spend and delivery only.

> This is a cohort measurement, not a guarantee of future revenue or an instruction to increase spend. The final business decision remains with the owner and ad buyer.

## Cohort-aligned calculation

The matched acquisition-and-purchase window is **August 1 through September 4, 2026**, using America/Chicago calendar dates. Meta spend for campaigns whose names contain both `Agora` and `Interconnected` was **$19,875.27**. Cleared Kajabi revenue for the active $67 and $199 offers was **$19,382.00**. The private Shopify match adds only **$5,188.00** from 11 qualifying orders associated with verified new Agora leads; it excludes all pre-existing, non-Agora, and unresolved Shopify orders.[1] [2]

| Revenue or cost component | Amount | Treatment |
|---|---:|---|
| Agora/Interconnected Meta spend | $19,875.27 | Denominator; delivery cost only |
| Cleared Kajabi $67 + $199 revenue | $19,382.00 | First-party direct revenue |
| Verified downstream Shopify revenue from new Agora leads | $5,188.00 | Incremental first-party cohort revenue |
| **Conservative blended first-party revenue** | **$24,570.00** | Kajabi direct revenue + verified downstream Shopify revenue only |

The calculation is:

```text
Conservative blended first-party ROAS
= (Kajabi direct revenue + verified downstream Shopify revenue) ÷ matched Meta spend
= ($19,382.00 + $5,188.00) ÷ $19,875.27
= 1.2362x
```

| View | Revenue | Spend | ROAS |
|---|---:|---:|---:|
| Kajabi direct only | $19,382.00 | $19,875.27 | **0.9752x** |
| Verified downstream Shopify only | $5,188.00 | $19,875.27 | **0.2610x** incremental contribution |
| **Conservative blended first-party** | **$24,570.00** | **$19,875.27** | **1.2362x** |

Verified downstream revenue adds **26.10 percentage points** of ROAS to the direct Kajabi-only reading for this acquisition-and-purchase cohort.

## What changes for the $4.7K daily capacity model

The existing early funnel model projected **1.21x** direct Kajabi revenue ÷ spend at the observed $0.82 CPC, 0.958% click-to-$67 conversion, and 18.18% $199 take rate. That is still the short-lag operating model; it should not be replaced with blended ROAS because verified Shopify purchases arrive later.[3]

If the observed downstream contribution of **0.2610x** is realized again after its normal purchase lag, the corresponding illustrative blended result at a $4,700 daily spend level would be:

| $4.7K planning view | Calculation | Value |
|---|---|---:|
| Direct Kajabi model | $4,700 × 1.21x | $5,687.00 |
| Illustrative delayed Shopify contribution | $4,700 × 0.2610x | $1,226.83 |
| Illustrative blended revenue | $5,687.00 + $1,226.83 | $6,913.83 |
| **Illustrative blended ROAS** | $6,913.83 ÷ $4,700 | **1.4710x** |

This is **not a new immediate promotion threshold**. The 11 verified downstream orders took an average of **8.36 days** from lead to purchase, with a median of **9 days** and a range of 1–13 days. A same-day or three-day scorecard will not yet contain much of that revenue.[2]

## Revised scale decision protocol

Use two separate measures rather than letting delayed revenue mask a direct-conversion deterioration.

| Scorecard measure | Window | Use | Guardrail |
|---|---|---|---|
| **Direct cash-conversion ROAS** | Latest three completed Central-time days | Promotion/hold/rollback decisions | Retain the existing direct Kajabi gate: promote at ≥1.10x; hold at 1.00x–1.09x; rollback below 1.00x for two completed days. |
| **Matured cohort blended ROAS** | Acquisition cohorts at least 14 days old | Validate downstream revenue contribution and long-run scale capacity | Include only verified new Agora-linked Shopify revenue; do not add unresolved or pre-existing orders. |
| **CPC, CTR, click-to-$67, and $199 take rate** | Latest three completed Central-time days | Protect the front end of the funnel | Retain the current operational thresholds; delayed Shopify revenue does not waive a CPC or base-conversion failure. |

The new downstream evidence **does support the capacity thesis**: the observed matured cohort is above 1.00x on a conservative first-party blended basis. It does **not** yet support a faster spend ramp. The next decision-grade check is whether another rolling 14-day Agora cohort continues to deliver at least a meaningful verified downstream contribution while the direct Kajabi gate and CPC controls remain intact.

## Limits

The analysis excludes **$1,197.00** from confirmed pre-August buyers, **$499.00** from a later non-Agora first-party record, and **$28,761.60** of unresolved qualifying Shopify revenue. It also excludes Meta-reported purchase value, refunds not yet reflected in the source records, payment fees, fulfillment, clinical costs, support, agency costs, and taxes. Three Kajabi contact-history pages timed out, so the pre-August classification is a minimum and the unresolved group is intentionally not treated as Agora revenue.[2]

## References

[1]: ./agora-199-ocus-take-rate-and-break-even-2026-09-04.md "Kajabi direct revenue and early direct economics"

[2]: ./agora-shopify-qualifying-buyer-attribution-2026-09-04.md "Verified private Shopify-to-Agora downstream revenue match"

[3]: ./agora-controlled-scale-plan-2026-09-04.md "Existing direct-conversion scale gates"
