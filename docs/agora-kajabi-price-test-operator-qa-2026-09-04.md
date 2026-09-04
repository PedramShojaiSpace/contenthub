# Agora Kajabi Entry-Price Test — Operator QA Checklist

**Status:** Draft-only preflight. Completing this checklist does not authorize creating offers, publishing checkout links, exposing a price, starting a traffic split, or changing Meta delivery.

> **Purpose:** Convert the approved non-live price-test design into a controlled, evidence-backed implementation request. A blank item is a hard blocker. The price test remains off until each required item is checked and the owner separately approves the exact activation scope.

## 1. What is already prepared in the Content Hub

The non-live registry at `server/agoraPriceTest.ts` defines the three fixed entry-price arms, preserves the current $67 control Offer ID (`2151314475`), reserves the exact current $199 OCUS Offer ID (`2151333044`), and deliberately marks the $49/$99 mappings, OCUS equivalence, external offer creation, and traffic allocation as incomplete. The only companion endpoint is protected and read-only: `agoraPriceTest.getDraftReadiness`.

| Prepared control | Current state | What it prevents |
|---|---|---|
| Named price arms | $49 treatment, $67 control, $99 treatment | Amount-only revenue matching |
| $67 mapping | Existing Offer ID `2151314475` recorded | Accidental replacement of the live control mapping |
| $49/$99 mappings | Explicitly `null` | Implied or fabricated Kajabi Offer IDs |
| $199 OCUS mapping | Existing Offer ID `2151333044` recorded; equivalence marked **false** | Treating shared price as proof of equal availability |
| Traffic allocation | Hard-coded **inactive** in the readiness snapshot | Unintended public split activation |
| Final price selection | No mutation/auto-promotion path exists | A browser conversion event choosing a live price |

Focused regression coverage passed **25/25** across the new price-test registry, existing A/B assignment logic, and exact Kajabi current-offer reporting. This validates code contracts only; it does not validate any live Kajabi configuration.

## 2. Exact Kajabi configuration worksheet

Kajabi supports separate Offers at different prices for the same underlying product; use a distinct Offer for each arm rather than a coupon or manually edited shared checkout.[1] The future $49 and $99 offer IDs must be copied from the actual created Offers and verified against a preview checkout before they are entered into the registry.

| Field to complete after owner authorizes setup | $49 treatment | $67 control | $99 treatment |
|---|---|---|---|
| Offer display name | `IC — Entry Price Test P1 — $49` | `IC — Entry Price Test P1 — $67 Control` | `IC — Entry Price Test P2 — $99` |
| Exact Kajabi Offer ID | **TBD — do not infer** | `2151314475` (confirm) | **TBD — do not infer** |
| Underlying product/access | Must equal control | Confirm current product/access | Must equal control |
| One-time entry price | $49.00 | $67.00 | $99.00 |
| Currency, tax, and payment options | Must equal control | Record control state | Must equal control |
| Checkout fields and policies | Must equal control | Record control state | Must equal control |
| Displayed price equals checkout price | Required | Required | Required |
| Publicly accessible checkout URL | **TBD after setup** | Existing control URL; recheck | **TBD after setup** |
| Approved status | Draft only until activation approval | Existing live control unchanged | Draft only until P2 approval |

**Non-negotiable rule:** do not create one Offer with multiple visible $49/$67/$99 choices. That measures choice/anchoring behavior, permits self-selection, and is not a clean price test.

## 3. $199 OCUS equivalence worksheet

The price test remains invalid if the higher-priced or lower-priced entry Offer changes the upgrade experience. Before activation, decide one of the two valid designs and document the selected design below.

| Valid design | Required proof | Chosen? |
|---|---|---|
| **Equivalent OCUS retained** | A controlled test checkout from each entry arm shows the same $199 offer, eligibility, price, value stack, and sequence; each eventual $199 transaction can be tied to its original price arm | ☐ |
| **OCUS suppressed for all arms** | The $199 offer is absent from every price arm for the entire base-price test; no arm receives a different post-purchase incentive | ☐ |

The following are invalid: an OCUS visible on only one arm; different $199 prices; different $199 copy/timing; or tying an upgrade to the arm only by its dollar amount. A test purchase must **not** be placed until separately authorized; use preview/read-only review first.

## 4. Sticky allocation and attribution QA

The planned P1 allocation is 50% to $49 and 50% to $67. P2 does not begin until P1 completes and owner approval names the retained P1 price as the P2 control. The existing system can support sticky weighted assignment, but no price-test assignment is connected or enabled today.

| QA item | Evidence required before activation |
|---|---|
| One experiment identifier | `agora-entry-price-v1` plus a phase identifier such as `P1` or `P2` |
| Returning-visitor consistency | Refresh/revisit checks show the same assigned arm and checkout destination |
| One arm per visitor | No cross-arm link, selection UI, query override, or fallback checkout is reachable from the test page |
| Original source retained | UTM source, medium, campaign, content, landing version, and campaign/ad-set keys pass through unchanged |
| Price arm captured at exposure | Non-identifying visitor/test key, arm, exposure time, and exact checkout Offer ID are stored before checkout click |
| Exact-offer revenue input | Each created Offer ID/expected cents is entered into the approved price-test reporter; never match price alone |
| $199 arm link | If OCUS is retained, its base-arm relationship is recorded from the original assigned cohort—not inferred from a standalone $199 transaction |
| Refund reconciliation | Exact base and upgrade refunded states are available before final readout |
| Central-time windows | Every operating day is evaluated only after it completes in America/Chicago |

## 5. Public-path QA after separate setup approval

These checks belong in the future setup action, before allocation activation. They do not authorize a live visitor or paid-traffic test.

| Check | Acceptable result | Stop immediately if |
|---|---|---|
| $49 preview | Exactly $49 on decision page and checkout; control-equivalent fields/policy | Any price mismatch or a link to a generic/shared checkout |
| $67 control preview | Existing $67 path remains intact | Existing path changes or breaks |
| $99 preview | Exactly $99 on decision page and checkout; control-equivalent fields/policy | Any mismatch or different product access |
| Upgrade preview | Selected equivalent or universally suppressed OCUS behavior is identical across arms | An arm sees a different upgrade condition |
| Refund and transaction read | Exact Offer IDs, cleared/refunded state, and Central-time dates are visible to the reporter | Only amount-based or gross-only reporting is possible |
| Isolation check | Test surfaces do not invoke Klaviyo/KO enrollment, SMS actions, or a different checkout platform | Any Kajabi/KO cross-enrollment or attribution leakage |
| Reader and route health | Page, checkout, current Kajabi reader, Meta spend reader, and thank-you/upgrade path return normally | Any health check fails |

## 6. P1 activation request template

Do not interpret a broad “yes” as permission to publish or route traffic. The activation request should name every action below.

> **Request for P1 approval:** Create/activate the approved $49 and $67 test checkout mapping only; publish exactly the named $49 test offer and expose a sticky 50/50 allocation from `P1 start` through `P1 end`; retain the named $67 control unchanged; use the selected $199-equivalence design; and collect aggregate exact-offer Kajabi measurement. No $99 traffic, Klaviyo/SMS changes, Meta campaign/budget/audience/creative edits, landing-page copy changes, coupons, or other routing changes are included.

The owner should approve the exact offer names/IDs, displayed checkout URLs, P1 start/end time, OCUS design, allocation surface, test cohort, and the action owner. The ad buyer should receive no spend-change instruction with this activation request.

## 7. Reporting and winner QA

Kajabi’s landing-page A/B reporting can help observe relative page behavior, but its GMV/conversion measure may include purchases beyond the tested offer and does not deduct refunds. Use exact Kajabi Offer transactions for the price decision and reconcile refunds before selecting a price.[2]

| Metric | Decision role |
|---|---|
| Direct net Kajabi revenue per assigned eligible entrant | Primary price-test outcome |
| Cleared base conversion per assigned eligible entrant | Guardrail and explanatory metric |
| Cleared $199 take rate per arm | Guardrail only; use only if equivalently available |
| Refund rate/amount by exact Offer ID | Required net-revenue adjustment |
| Checkout health and mismatch count | Automatic hold/no-go |
| Meta spend, clicks, CPC, and CTR | Delivery stability only; no Meta purchase value in decision |
| 14-day mature cohort review | Required before final price selection |

Select an arm only if the documented plan’s predeclared test rule passes: at least 1,000 assigned eligible entrants and 30 cleared base buyers per arm, a full 14-day maturity window, a minimum 15% direct net Kajabi revenue-per-entrant advantage, a pre-specified 95% confidence interval excluding no improvement, and no guardrail failures. A 30-day cap without this evidence is **inconclusive**; retain the incumbent price.[3]

## 8. Explicitly out of scope

This non-live build does not make a Kajabi offer, checkout, price, coupon, page, email sequence, Klaviyo form, flow, list, profile, SMS consent, test message, tracking/pixel event, Meta campaign, ad set, ad, audience, or budget change. It does not enroll or message a contact and it does not alter either Agora or VIBE reporting.

## References

[1]: https://help.kajabi.com/articles/sales/checkout/can-i-create-an-offer-checkout-page-with-different-pricing "Kajabi: create an offer checkout page with different pricing"

[2]: https://help.kajabi.com/articles/website/pages/landing-page-ab-testing-overview "Kajabi: landing-page A/B testing overview and attribution limits"

[3]: ./agora-cro-validation-sprint-2026-09-04.md "Agora CRO validation sprint"
