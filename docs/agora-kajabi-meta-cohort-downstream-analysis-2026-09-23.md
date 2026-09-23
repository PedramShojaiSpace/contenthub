# Agora Meta Lead Cohort: Kajabi Downstream Purchase Analysis

**Prepared:** 23 September 2026, 11:15 a.m. Central  
**Scope:** Meta/Agora-acquired Interconnected leads on the Kajabi path, from 1 August through the time of the read.  
**Measurement authority:** First-party `interconnected_leads` and `kajabi_purchases` records only. Meta supplies acquisition identity through the recorded source/campaign fields; Kajabi webhook-captured purchases supply the revenue evidence.  
**Privacy boundary:** All matching occurred by normalized email and chronology in process. This document contains aggregate results only.

## Direct answer

There **is** a verified historical Kajabi cohort of people who entered through the Interconnected Meta/Agora lead path and later bought in Kajabi. However, in the available first-party Kajabi ledger, virtually all of that additional revenue is **the immediate Kajabi one-click upsell**, not a later conversion created by Kajabi's ongoing email mechanics.

For the mature 14-day-or-older cohort, **88** Meta/Agora Kajabi leads purchased the $67 entry offer. **14 of those 88 buyers (15.91%)** also purchased a post-purchase offer within 24 hours, generating **$2,786**. There are **zero recorded positive Kajabi purchases after the first 24 hours** from those $67 buyers in this matching set.

> **Interpretation:** The historical Kajabi funnel proves that the $67 checkout plus immediate one-click upsell can monetize paid traffic. It does **not** prove that Kajabi's later buyer nurture was creating meaningful tracked downstream Kajabi revenue. That is precisely the layer Klaviyo is better positioned to own and measure.

## Cohort definition

A lead qualified for this analysis only if the first-party record met all of the following conditions:

1. It was on the **Kajabi** Interconnected path.
2. It recorded a Meta/Facebook source, an Agora/Interconnected campaign signal, or a Meta campaign identity.
3. A positive Kajabi purchase with the same normalized email occurred after the lead timestamp.
4. Purchase records were deduplicated by Kajabi order identifier, with a stable time-based fallback only when no order identifier was present.

The $67 Interconnected purchase is treated as the **entry sale**. A positive purchase for the same buyer that occurred afterward is classified as either an **immediate post-purchase purchase** (within 24 hours of the $67 entry purchase) or a **delayed purchase** (more than 24 hours later).

## Results

| Measure | All available Meta/Agora Kajabi cohorts | Mature cohorts (lead at least 14 days old) |
|---|---:|---:|
| Unique qualified Meta/Agora Kajabi leads | 3,659 | 2,625 |
| $67 entry buyers | 125 | 88 |
| Lead → $67 buyer rate | 3.42% | 3.35% |
| $67 entry revenue | $8,375 | $5,896 |
| Buyers with any additional Kajabi purchase | 19 | 14 |
| Additional-purchase rate among $67 buyers | 15.20% | 15.91% |
| Immediate post-purchase revenue (within 24h) | $3,681 | $2,786 |
| Delayed post-purchase revenue (after 24h) | **$0** | **$0** |
| Combined matched Kajabi revenue | $12,123 | $8,749 |
| Combined matched revenue per qualifying lead | $3.31 | $3.33 |

## What buyers actually bought after the $67 entry offer

| Post-entry offer | Purchases | Revenue | Timing relative to $67 entry |
|---|---:|---:|---|
| Gut Permeability and Food Sensitivity Testing with Coach Consultation — $199 | 18 | $3,582 | All within 24 hours |
| Upstream: The Complete Microbiome Solution — $99 | 1 | $99 | Within 24 hours |
| **Total additional Kajabi purchase revenue** | **19** | **$3,681** | **All within 24 hours** |

The $199 OCU accounts for **97.31%** of the observed immediate post-entry revenue. The single $99 Upstream purchase is too new and too small a sample to establish a $99 take rate or compare to the earlier $199 OCU.

## What this means for the Kajabi-versus-Klaviyo decision

The evidence supports a clean division of labor:

| Funnel layer | Best current system | Reason |
|---|---|---|
| Paid traffic landing page and opt-in experience | Continue measuring Kajabi and Unbounce/Klaviyo independently | Page layout and speed can affect lead rate; the two paths need separate denominators. |
| $67 checkout, course entitlement, and native OCU | **Kajabi** | The existing Kajabi $67 checkout and native OCU have proven immediate monetization; the new $99 digital OCU preserves the same native mechanism. |
| Buyer lifecycle after purchase | **Klaviyo** | The historical Kajabi record does not show delayed Kajabi product purchases after the first day. Klaviyo provides better branching, suppression, resend, and sequence reporting for the delayed lifecycle. |
| Financial authority | **Kajabi** for Kajabi purchases | Use cleared Kajabi transactions and the first-party ledger, never Meta purchase value, for actual revenue. |

This does **not** justify declaring Kajabi's funnel unsuccessful. The historical result shows a viable front-end plus OCU. It does justify avoiding a duplicated long-term buyer nurture in Kajabi when the more sophisticated Klaviyo flow can become the deliberate post-purchase system.

## Recommended 10–14 day decision protocol

The current setup should be judged as a new **Klaviyo acquisition → Kajabi checkout → Kajabi OCU → Klaviyo buyer lifecycle** cohort, not as a continuation of the former Shopify/Zipify challenger. Keep the historical cohorts separate from the checkout cutover onward.

| Decision question | First-party measure | Window | Decision use |
|---|---|---|---|
| Is the new acquisition path producing paid buyers? | Qualified leads, $67 buyers, cleared Kajabi $67 revenue | Daily, then 10–14 completed days | Front-end health |
| Is the new $99 Upstream OCU working? | Exact Kajabi OCU ID `2151104453`; accepts, take rate, and revenue | At least 50 paid $67 buyers before a directional decision | Immediate monetization |
| Does Klaviyo buyer nurture create delayed revenue? | Buyer-event cohort matched to subsequent Kajabi purchases, excluding transactions in the first 24 hours | 14-day and 30-day matured cohorts | Lifecycle value |
| Should Kajabi email be retired for these buyers? | Delayed purchaser rate/revenue plus delivery and engagement evidence from the Klaviyo buyer flow | After the flow is live and a cohort matures | Operating simplification |

The immediate next implementation is already directionally correct: use the Kajabi checkout for the $67 offer, preserve the native $99 Upstream OCU, and let a verified Kajabi purchase send the purchaser into the dedicated Klaviyo buyer flow while non-buyers continue through the existing Klaviyo prospect journey. The buyer flow must still be fully QA'd and explicitly activated; it should not receive SMS unless separate consent exists.

## Limits

This is a conservative **Kajabi-only** downstream analysis. It does not add Shopify test-kit, consultation, or high-ticket orders; those require a separate verified identity-and-source match. It also does not prove that a person saw or clicked a specific Kajabi email because historical message-click tokens were not preserved in the Kajabi purchase webhook. A zero delayed purchase result means **no delayed positive Kajabi purchase was recorded in the available matched ledger**; it does not prove that no buyer later purchased elsewhere or that no email had value.

No ads, budgets, checkout settings, offers, prices, Klaviyo flows, Kajabi automations, email/SMS, product access, or orders were changed to produce this analysis.

## Related records

- [Historical Kajabi ROAS check](./agora-kajabi-roas-2026-09-18.md)
- [Historical blended first-party ROAS](./agora-blended-first-party-roas-2026-09-04.md)
- [Kajabi checkout and Klaviyo lifecycle scope](./interconnected-kajabi-checkout-klaviyo-lifecycle-scope-2026-09-22.md)
- [Klaviyo thank-you page Kajabi checkout cutover](./klaviyo-thank-you-kajabi-checkout-swap-2026-09-23.md)
