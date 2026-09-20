# Interconnected Split-Test Measurement Plan

**Prepared by:** Manus AI  
**Date:** September 20, 2026  
**Status:** Measurement plan only. It does not activate ads, re-route visitors, modify a Kajabi offer, or change an existing campaign.

## The core recommendation

The brand should run **two separate experiments**, not one combined test. The current Klaviyo/Unbounce/Shopify traffic is a **destination-path experiment**. The $67-versus-$99 Kajabi offer is a **price experiment**. Combining the two would change both the checkout path and the price at the same time, making any result impossible to interpret.

The destination-path experiment compares the existing Kajabi flow with the Unbounce → Klaviyo → Shopify flow. The price experiment compares the $67 Kajabi offer with the staged $99 Kajabi offer while keeping the same Kajabi product access, post-purchase route, and $199 one-click upsell. In both cases, the decision is based on paid, non-refunded first-party revenue—not click-through rate, cost per click, or Meta’s modeled purchase value.

> **The price test should not be operated by manually sending an arbitrary half of traffic to a different page.** Its assignment must be random and recorded at the moment a person enters the offer path. This is what makes the result defensible.

## Experiment 1: Kajabi versus Klaviyo/Shopify destination path

This is the experiment that can begin receiving the current Klaviyo traffic. The existing Kajabi path is the control and the Unbounce → Klaviyo → Shopify path is the challenger. The test should use Meta’s native A/B test workflow so Meta randomizes eligible traffic between the two arms. The target audience, creative, placements, optimization event, attribution window, and daily budget must remain identical; the destination is the only substantive difference.[1]

| Item | Kajabi control | Klaviyo/Shopify challenger |
|---|---|---|
| Experience | Existing Kajabi screening and checkout path | Unbounce LP-3 → Klaviyo flow → Shopify product/checkout |
| Required campaign identity | `IC-Destination-Test-Kajabi-Control-v1` | `Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1` |
| Lead record | `funnel_path = kajabi` | `funnel_path = ko_klaviyo` |
| Revenue authority | Cleared, paid, non-refunded Kajabi transactions | Paid, non-refunded Shopify order for the registered Interconnected product |
| Primary outcome | 14-day booked revenue per qualified lead and 14-day booked ROAS | Same |

The Content Hub already separates the two funnels in the **Sales Reconciliation** page. The Kajabi control is stored under `interconnected_agora`; the challenger is stored under `interconnected_ko_shopify`. The challenger name must retain `Interconnected KO` in either the campaign or ad-set name so its Meta spend enters the Shopify/Klaviyo ledger rather than blending into Kajabi.[2]

## Experiment 2: $67 versus $99 Kajabi entry price

Do **not** test the $99 page against the Shopify/Klaviyo challenger. Run this after the destination-path decision is made, or run it only inside the Kajabi control path with the destination held constant. The proper assignment point is immediately after the common Kajabi opt-in. A Content Hub assignment layer should randomly and permanently assign each new qualified lead to one of two arms:

| Arm | Thank-you / offer route | Recorded assignment | Constant items |
|---|---|---|---|
| Control | Existing $67 Kajabi flow | `p67` | Same traffic source, course access, post-purchase page, and $199 OCUS |
| Treatment | $99 Kajabi thank-you route | `p99` | Same traffic source, course access, post-purchase page, and $199 OCUS |

The assignment must be stored in the first-party lead record and passed into the thank-you-page URL. A visitor must never be re-randomized on refresh, revisit, email click, or device-level page reload. This avoids one person appearing in both arms and lets the Content Hub link exact Kajabi Offer IDs to the correct lead cohort.

The current **Interconnected Price Test** tracker already holds the exact $67 and $99 offer mappings and reads exact-offer Kajabi revenue. Before activation, it needs the lead-level `p67` or `p99` assignment feed described above. Without that assignment, the tracker can report sales by offer but cannot calculate a definitive revenue-per-lead or ROAS comparison.[3]

## How the Content Hub will document the outcome

Each record must have a stable test key, arm, first-party lead timestamp, UTM campaign/content, and the downstream paid-order record. The following views then provide a complete audit trail.

| Content Hub record | What it documents | Why it matters |
|---|---|---|
| First-party lead ledger | One qualified lead, its path or price arm, UTMs, Klaviyo sync state, and CAPI delivery state | Establishes the denominator and validates that a lead was not lost in transit |
| KO/Klaviyo/Shopify reconciliation | Meta spend, first-party KO leads, Shopify paid revenue, buyer CPA, and ROAS | Measures the challenger without mixing in Kajabi revenue |
| Kajabi reconciliation | Meta spend and cleared Kajabi revenue for the control | Measures the original Kajabi path on the same reporting period |
| Price-test tracker | Exact Kajabi Offer ID, cleared $67/$99 sales, and the shared $199 OCUS | Prevents amount-only matching and keeps the price test separate from destination testing |
| Final cohort report | Equal-age lead cohorts, paid/non-refunded revenue, refunds, exclusions, and match coverage | Produces the actual winner decision rather than a platform-attribution claim |

The live operational check for a new Klaviyo/Unbounce lead is deliberately narrow: it must create exactly one `ko_klaviyo` lead record, preserve the paid-media UTMs, show a successful Klaviyo sync, and show exactly one Meta CAPI Lead delivery. The hourly owner summary already reports the KO/Klaviyo count separately from Kajabi and sends no individual lead alerts.[4]

## Decision rule and timing

The first reading is only a health check. It confirms that delivery and attribution are working. It is not a winner declaration. Compare the test arms after each has at least **250 unique first-time qualified leads**, then wait until the newest included lead has had **14 full days** to buy and receive follow-up email. If the result is still close, continue to 500 leads per arm.

The winning path or price is the arm with the higher **14-day booked revenue per qualified lead** and **14-day booked ROAS**, provided the revenue is paid, non-refunded, and matched to the correct first-party cohort. Supporting diagnostic metrics are lead-to-entry-buyer conversion, buyer CPA, $199 one-click-upsell take rate, refund rate, and email-delivery coverage. CPC can be reviewed as a delivery-health signal only; it is not an outcome metric.

## Immediate monitoring of the newly started Klaviyo traffic

The current live traffic is being treated as a monitored KO/Klaviyo launch, not as proof that the price test has begun. The first real lead will be verified against the following four fields: one first-party KO lead; complete campaign identification; Klaviyo sync; and a single CAPI Lead. The existing hourly summary will continue to deliver the rolling KO/Klaviyo count separately from Kajabi. No individual lead notifications, SMS settings, ad settings, or traffic allocation will be changed during this observation.

## Initial live KO launch validation

At approximately 11:07–11:09 Central on September 20, the first four newly recorded KO/Klaviyo leads passed the first-party transport check: four lead rows were created, all four show Klaviyo sync, and all four show a single server-side Meta CAPI Lead delivery. The next aggregate delivery read showed ten recently added profiles with successful email-list membership.

The initial four rows use the native fallback campaign label `interconnected_unbounce_native` and have no `utm_content` or Meta campaign key. This means the acquisition and CAPI path is functioning, but these earliest leads are **not yet cleanly labeled for a paid destination experiment**. Before treating additional traffic as the challenger cohort, the active ad destination must carry the KO UTM contract: `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign=ic_destination_test_ko_shopify_challenger_v1`, and `utm_content=healthy_habits_control_image_v1`.

Klaviyo confirmed the live flow is triggered by the Interconnected Free Screening Opt-Ins list; its Day 0 email is live, has no configured delay, and has smart sending disabled. The initial read did not yet show a `Received Email` event for the earliest profiles, so delivery was left open pending a delayed provider read. Existing-profile SMS events are not interpreted as new consent from the Unbounce form.

## Paid LP-3 → Klaviyo delivery verification — 12:19 Central

The live-flow verification is complete for the current paid LP-3 traffic. The intended Klaviyo flow, **`YyFZPu` — “[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN,”** is live and its entry trigger is the **Interconnected Free Screening Opt-Ins** list. The first Day-0 email, **“Day 0 opt in EG sp26,”** is live, has no delay, and has Smart Sending disabled.

A privacy-minimized read of the 180-minute paid LP-3 cohort found **21** records with `funnel_path = ko_klaviyo`. All 21 first-party lead records were marked as successfully synchronized to Klaviyo. Each corresponding Klaviyo profile had a **Received Email** event dated after its own lead timestamp. There were no unresolved delivery exceptions and no profile lookup failures at the time of the check. No new test lead, email, SMS, flow edit, audience edit, or ad setting was created for this verification.

> This establishes current enrollment and Day-0 delivery for the paid LP-3 cohort. It is not a revenue result, and it does not change the requirement to evaluate the KO route against the Kajabi route using cleared revenue and the agreed cohort maturity window.

## References

[1]: https://content.theurbanmonk.com/hub/analytics/reconciliation "Urban Monk Content Hub Sales Reconciliation"
[2]: https://try.theurbanmonk.com/interconnected-lp-3/ "Interconnected LP-3 Unbounce landing page"
[3]: https://content.theurbanmonk.com/hub/analytics/interconnected-price-test "Interconnected Price Test Tracker"
[4]: https://content.theurbanmonk.com/interconnected/thank-you-klaviyo "Interconnected Klaviyo thank-you page"
[5]: https://www.klaviyo.com/flow/YyFZPu/edit "Klaviyo: Interconnected Free Screening KO flow"
