# Agora Funnel: Controlled Scale Plan to $4.7K per Day

**Status:** Draft for owner and ad-buyer review; no advertising changes made.  
**Planning basis:** Kajabi cleared transactions are the sole revenue source of truth. Meta is used only for spend, impressions, link clicks, leads, and checkout signals.[1]

> **Decision boundary:** This is a risk-managed operating plan, not a guarantee of results or a direction to change spend. No stage advances unless the stated Kajabi and delivery gates are met using completed Central-time days.

## 1. Starting economics and scale objective

The post-restart cohort recorded **11 cleared $67 base purchases** and **two cleared $199 one-click upgrades**, an observed 18.18% upgrade take rate. Matched delivery was $938.91 across 1,148 link clicks, equivalent to **$0.82 CPC**, 5.75% link CTR, 0.958% click-to-$67 conversion, and $85.36 observed media cost per $67 purchase.[1]

At those early-cohort rates, ten $199 upgrades daily model to 55 $67 base purchases, about 5,740 link clicks, and **$4,694.55 daily media spend**. This plan rounds the modeled ceiling to **$4,700/day** but treats it as a capacity target, not a budget instruction.

| Guardrail | Current basis | Operating threshold |
|---|---:|---:|
| CPC | $0.82 | Promote only at or below **$0.90**; hard economics ceiling **$0.99** |
| Link CTR | 5.75% | Promote only at or above **4.90%** on a trailing completed-day view |
| $67 purchases per link click | 0.958% | Promote only at or above **0.85%** |
| $199 take rate | 18.18% | Hold below **12%**; hard gross-media floor **9.22%** |
| Kajabi revenue ÷ Meta spend | 1.21x modeled | Promote only at or above **1.10x**; hold below **1.00x** |

The 1.10x promotion floor leaves a small operating buffer above the 1.00x gross media break-even floor. It does **not** include payment fees, refunds, support, fulfillment, clinical costs, agency costs, taxes, or other operating expenses. Those costs need a separate contribution-margin model before treating 1.10x as business-level break-even.

## 2. Non-negotiable measurement rules

All reporting uses **America/Chicago calendar days**. Evaluate performance only after a completed day has settled; never promote, hold, or roll back from a partial day. Use the same offer IDs for the $67 base offer and $199 one-click upgrade in every Kajabi pull. Keep the two Kajabi order counts separate.

```text
$199 take rate = cleared $199 upgrades ÷ cleared $67 base purchases
First-party revenue ROAS = (cleared $67 revenue + cleared $199 revenue) ÷ Meta spend
```

Meta purchase value and Meta-reported ROAS are deliberately excluded from the decision scorecard. They can be retained as diagnostic signals, but they must not be used to promote spend or determine profitability.

Before each budget step, confirm that the Kajabi order reader, Meta spend reader, opt-in page, thank-you path, checkout, and one-click-upgrade presentation all return normally. A tracking, page, checkout, or database error is an automatic **hold**—not a reason to guess from platform metrics.

## 3. The scale ladder

Hold each rung for **at least 72 hours** and use the three most recent completed Central-time days to make the next decision. The deliberate 20% increments protect learning stability and reduce the chance of a sudden auction-price shock.

| Stage | Daily spend ceiling | Minimum observation before next step | Advance only if all gates pass |
|---:|---:|---|---|
| Baseline | $325 | 72 hours | Measurement is clean; no unresolved checkout/thank-you issue |
| 1 | $390 | 72 hours | All promotion gates above pass |
| 2 | $470 | 72 hours | All promotion gates above pass |
| 3 | $565 | 72 hours | All promotion gates above pass |
| 4 | $680 | 72 hours | All promotion gates above pass |
| 5 | $815 | 72 hours | All promotion gates above pass |
| 6 | $980 | 72 hours | All promotion gates above pass |
| 7 | $1,175 | 72 hours | All promotion gates above pass |
| 8 | $1,410 | 72 hours | All promotion gates above pass |
| 9 | $1,695 | 72 hours | All promotion gates above pass |
| 10 | $2,035 | 72 hours | All promotion gates above pass |
| 11 | $2,445 | 72 hours | All promotion gates above pass |
| 12 | $2,935 | 72 hours | All promotion gates above pass |
| 13 | $3,520 | 72 hours | All promotion gates above pass |
| 14 | $4,225 | 72 hours | All promotion gates above pass |
| 15 | $4,700 | Ongoing | Maintain only while gates continue passing |

At the minimum 72-hour cadence, this reaches $4,700 in about **45 days**, assuming every gate passes. Faster growth is not safer merely because early results look promising. The scale ladder pauses automatically whenever evidence is insufficient.

## 4. Capacity strategy: scale without concentrating risk

Do not raise every ad set together. Separate the budget into a **proven core**, a **stable expansion layer**, and a **controlled discovery layer**. Keep the core as the only layer that receives routine ladder increases. The stable expansion layer earns further allocation only after it independently clears the same Kajabi gates. The discovery layer has a fixed cap and never subsidizes the core decision.

| Budget bucket | Initial ceiling of total daily spend | Purpose | Rule |
|---|---:|---|---|
| Proven core | 60–70% | Existing creative/audience combinations with verified Kajabi orders | Increase only by the ladder; do not materially edit a current winner while evaluating it |
| Stable expansion | 20–30% | Independently working audiences or creative concepts | Promote only after its own 72-hour qualified window |
| Controlled discovery | 10% maximum | New creative/audience hypotheses | Fixed capped spend; no scale based on clicks alone |

No single campaign should carry more than **35%** of the total daily ceiling once spend exceeds $1,000/day. This prevents one creative, audience, or delivery fault from taking down the entire funnel. Existing winning ad sets should not be duplicated or edited simply to force spending; that can reset learning and obscure the source of a CPC increase. New capacity should be added as separately measurable budget buckets rather than by making one winning unit absorb the entire target.

## 5. Promotion, hold, and rollback protocol

Use the table below at the same morning decision point each day, after Kajabi cleared transactions are available for the last completed Central-time day. Use three completed days for any promotion decision. Require at least **25 $67 base purchasers** in the rolling decision window before treating the $199 take rate as a promotion gate; before that point, hold the current stage even if the early observed take rate is strong.

| Decision | Trigger | Required action |
|---|---|---|
| **Promote** | 72 completed hours, at least 25 $67 base purchases, CPC ≤ $0.90, CTR ≥ 4.90%, $67 conversion ≥ 0.85%, $199 take rate ≥ 12%, and Kajabi revenue ÷ spend ≥ 1.10x | Raise only the qualified budget bucket by one ladder rung; keep all other variables unchanged |
| **Hold** | Any promotion criterion is unavailable, sample is below 25 $67 purchasers, CPC is $0.91–$0.98, take rate is 9.22%–11.99%, or first-party ROAS is 1.00x–1.09x | Do not raise budgets; inspect creative fatigue, audience saturation, page/checkout health, and transaction timing |
| **Rollback one rung** | CPC exceeds $0.99 for two completed days, CTR is below 4.90% for two completed days, $67 conversion is below 0.85% for two completed days, or first-party ROAS is below 1.00x for two completed days | Return the affected bucket to its last qualified ceiling; do not touch unrelated winners |
| **Immediate stop and investigate** | Checkout, thank-you, offer, lead capture, Kajabi transaction reader, or Meta spend reader is broken or materially unavailable | Freeze all increases; do not interpret unavailable data as a performance outcome |

The $199 take rate deserves special caution. The observed 18.18% comes from only two upgrades, so it has high sampling variability. A 12% promotion threshold, a 9.22% hard gross-media floor, and the 25-base-purchase minimum create a more reliable decision structure than reacting to each new order.

## 6. Daily operator scorecard

The operator should keep a single completed-day scorecard. Each row is an observation, not a target to optimize in isolation.

| Field | Source | Why it matters | Decision use |
|---|---|---|---|
| Date and stage | Manual | Maintains audit trail | Required |
| Spend, impressions, link clicks, CPC, link CTR | Meta delivery read | Detects auction-price and creative-fitness changes | CPC/CTR gates |
| Leads and checkouts | Meta delivery read | Early diagnostic signal | Context only; not revenue |
| Cleared $67 orders / revenue | Kajabi | Base conversion and revenue | Required |
| Cleared $199 upgrades / revenue | Kajabi | Take-rate calculation | Required |
| $199 take rate | Calculated | Determines upgrade contribution | Required |
| Kajabi revenue ÷ Meta spend | Calculated | First-party gross media economics | Required |
| Page, thank-you, checkout, and reader health | Read-only verification | Prevents false performance interpretation | Required |
| Decision and rationale | Manual | Makes actions reversible and auditable | Required |

## 7. Controls for the ad buyer

The ad buyer should execute only a written, owner-approved stage change that names the affected budget bucket, current ceiling, next ceiling, start time, and expected 72-hour review time. The operator should not make a second variable change—such as audience, creative, copy, bid strategy, destination, or attribution setting—inside the same observation window. If a new creative is introduced, it belongs in the capped discovery bucket and gets a separate readout.

Keep Agora and VIBE reporting separate. Do not borrow VIBE results to justify Agora spend or merge their conversions in the same scorecard. Maintain the current Kajabi-only revenue rule and do not allow Meta purchase value to overrule a cleared Kajabi count.

## 8. Bottom line

The early observed economics make a $4.7K/day capacity plan **plausible** on a gross-media basis, but the correct path is a 20%-per-72-hour ladder with strict Kajabi gates—not a rapid budget jump. The plan reaches the modeled ceiling only if CPC stays below the operational cap, base conversion holds, and the $199 take rate remains above its gross-media break-even floor with a sufficiently large Kajabi cohort.

## References

[1]: ./agora-199-ocus-take-rate-and-break-even-2026-09-04.md "Kajabi-only $199 one-click upgrade take-rate and break-even calculation"
