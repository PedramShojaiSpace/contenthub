# Agora Funnel: CRO Validation Sprint Before Any Spend Increase

**Prepared:** September 4, 2026  
**Status:** Decision-ready design only. No Kajabi offer, checkout, price, landing page, traffic allocation, Klaviyo flow, form, list, profile, consent state, message, SMS enrollment, analytics setting, Meta campaign, ad set, ad, audience, bid, or budget has been changed.

> **Operating principle:** The next dollar of scale should follow proof that the path converts cleanly—not substitute for it. The price experiment and the Klaviyo/SMS validation are distinct experiments. They must not share an attributed cohort, a checkout path, a revenue numerator, or a winner decision.

## 1. Why this sprint comes before scale

The current early Agora economics are promising but still volatile: the existing direct measurement basis is the exact **$67 Kajabi entry offer** plus the exact **$199 Kajabi one-click upgrade**. The post-restart cohort contains only 11 cleared base purchases and two upgrades, so it is not adequate evidence to change price and raise budget at the same time.[1] [2]

The direct Kajabi reporting code explicitly filters by exact offer ID rather than price alone. The active reporting IDs are `2151314475` for the $67 entry and `2151333044` for the $199 OCUS.[3] Any $49 or $99 test offer must therefore be added as a new named measurement arm; otherwise, its transactions will be invisible to the existing exact-offer scorecard and will contaminate the answer.

Kajabi permits multiple Offers with different prices for the same Product, so a controlled price test can use three distinct checkout offers without changing the underlying product access.[4] Kajabi’s native landing-page A/B reporting is **not** sufficient as the financial decision source for this price test: its conversion/GMV attribution can include purchases of other offers, is browser-cookie based, and does not deduct refunds. The exact Kajabi transaction ledger remains the source of truth for price-arm revenue and orders.[5]

| What is being tested | What stays fixed | Primary decision metric | Revenue authority |
|---|---|---|---|
| **Kajabi entry price** | Traffic source, paid creative, audience, landing/decision-page copy, value stack, checkout sequence, $199 OCUS availability, and timing | Matured net Kajabi revenue per assigned eligible entrant | Exact Kajabi offer transactions |
| **Klaviyo + optional SMS path** | No price change, no concurrent price allocation, approved message content, checkout destination, and list/flow purpose | First, end-to-end path integrity; later, channel-specific conversion per eligible entrant | Separate KO/Klaviyo path ledger; do not pool with Kajabi |

## 2. Experiment A — Kajabi $49 / $67 / $99 entry-price validation

### Recommended structure: two sequential 50/50 comparisons

Do **not** put all three prices in front of the same visitor, use a coupon against a shared checkout, or show a visible “choose your price” menu. Those designs test choice architecture and discount perception—not the price point. They also create price leakage if a person returns or shares a link.

Instead, use the $67 price as the fixed control and run two sequential, sticky-assignment comparisons. This preserves enough traffic per arm to learn at the present conversion volume while ensuring every returning visitor sees the same price.

| Stage | Allocation | Decision question | Required result before next stage |
|---|---|---|---|
| **P0 — readiness** | No public allocation | Can all three price arms be measured exactly and present the same functional purchase path? | All technical and attribution checks pass; owner approves activation |
| **P1 — lower-price test** | 50% $67 control / 50% $49 treatment | Does $49 produce materially more net direct revenue per eligible entrant than $67? | A winner under the predeclared rule, or an inconclusive result with $67 retained |
| **P2 — higher-price test** | 50% current champion / 50% $99 treatment | Does $99 produce more net direct revenue per eligible entrant than the retained champion? | A final selected price or a documented inconclusive result with the incumbent retained |

The sequential structure is deliberate. A simultaneous three-way test would divide limited observations into thirds and delay a usable answer. The trade-off is that P2 must preserve the same traffic-source, creative, audience, decision-page, and checkout conditions as P1; any material delivery change creates a new test rather than a valid price comparison.

### P0 setup requirements

Each arm needs a distinct Kajabi Offer attached to the same underlying access/product, with a price of exactly $49, $67, or $99. The public decision-page copy, bonuses, payment method availability, checkout fields, refund policy, timer behavior, support/contact links, and all post-purchase steps must be identical except for the displayed entry price and exact checkout URL.

The $199 OCUS cannot be left ambiguous. Before public assignment begins, confirm that each base Offer either leads to the **same verified $199 one-click upgrade** under the same eligibility and price rules, or suppress the OCUS for **all** price arms during the base-price test. Allowing the $67 arm to retain a working upgrade while a new $49/$99 arm does not would create a bundled price-plus-upsell test and invalidate the result.[1]

| Required preflight check | Pass condition | No-go condition |
|---|---|---|
| Entry offer mapping | A written lookup maps each price arm to one exact Kajabi Offer ID and price | Matching by dollar amount alone, reused offer IDs, or an undocumented coupon |
| Page-to-checkout parity | Assigned page clearly shows the same price that the assigned checkout displays | A page/checkout price mismatch, fallback to a generic checkout, or price-selection menu |
| Sticky assignment | A first-party test key holds a visitor in the same arm for the full test | A visitor can refresh, revisit, or use a known link to receive a different price |
| $199 OCUS equivalence | Same verified availability, price, and attribution relationship for every arm—or omitted from every arm | An upgrade is available for only one arm, has different price/copy, or cannot be tied to its base buyer |
| Attribution fields | `experiment_id`, `price_arm`, assigned timestamp, original UTM set, landing version, and checkout offer ID are retained | Price arm is inferred from a report after the fact |
| Refund ledger | Cleared and refunded exact-offer events can be reconciled before declaring a winner | Gross receipts only, with no refund treatment |

The existing internal experiment router can support sticky, weighted assignment, but it currently auto-concludes from generic browser-recorded conversions. That is useful for allocation mechanics, not for the final financial verdict. It must not auto-promote a price arm until the decision logic is hardened to use exact Kajabi Offer IDs, defined refund handling, and owner review.[6]

### Measurement contract

The test cohort begins when a **new, eligible visitor reaches the assigned decision page** after the fixed upstream path. Exclude known prior buyers, duplicate assignments, internal QA traffic, and people whose browser identity cannot be assigned. Record a non-identifying first-party visitor/test key rather than surfacing personal data in reports.

Use completed **America/Chicago** calendar days only. Give each entrant 14 days from first assigned exposure before the final revenue comparison; this permits delayed direct transaction and refund reconciliation without importing downstream Shopify revenue into a Kajabi price decision.[1] Interim data can be viewed daily, but it cannot authorize a price winner or a budget increase.

```text
Base conversion rate
  = cleared exact base-offer purchases ÷ assigned eligible entrants

$199 OCUS take rate
  = cleared exact $199 upgrades tied to an arm’s cleared base buyers
    ÷ cleared base-offer buyers in that arm

Direct net Kajabi revenue per entrant
  = (cleared base revenue + eligible cleared $199 upgrade revenue
     − refunded base/upgrade revenue) ÷ assigned eligible entrants

Arm-level direct Kajabi ROAS
  = arm-level direct net Kajabi revenue ÷ proportionally allocated Meta spend
```

For the price decision, **direct net Kajabi revenue per eligible entrant** is primary. Base conversion rate, checkout-start rate, base revenue per buyer, $199 take rate, refund rate, payment/checkout errors, and opt-out/support complaints are guardrails. Meta contributes only the matched spend, impressions, clicks, leads, CPC, and CTR needed to watch upstream stability; it does not supply purchase value or make the revenue decision.[1] [3]

### Minimum evidence and decision rules

Because the current base-purchase sample is small, the experiment must not select a price from a handful of orders. The following criteria should be set before P1 begins and reused for P2.

| Decision | Required evidence | Action |
|---|---|---|
| **Select a price arm** | At least 1,000 assigned eligible entrants **and** at least 30 cleared base buyers in each arm; every arm has a full 14-day maturity window; the selected arm has at least 15% higher direct net Kajabi revenue per entrant; a pre-specified 95% interval excludes no improvement; and all guardrails pass | Retain that price as the next-stage control or operating price after separate owner approval |
| **Continue collecting** | The 14-day window is incomplete or either arm is below the minimum observation volume | Keep allocation unchanged; do not edit copy, creative, traffic source, OCUS, or price during the window |
| **Inconclusive** | A 30-completed-day cap is reached without a clear winner, or the confidence interval includes no improvement | Keep the $67 incumbent (or P1 champion for P2); do not declare a lift |
| **Pause the treatment** | After at least 300 assigned entrants and 10 cleared base buyers per arm, an arm trails control by 30% or more on direct net revenue per entrant for three completed Central-time days, or any technical/consent/checkout guardrail fails | Pause only the affected test allocation; investigate; do not compensate by increasing Meta spend |
| **Immediate no-go** | Incorrect checkout price, transaction/offer-ID mismatch, non-sticky allocation, failed page/checkout, missing $199 equivalence, or inability to reconcile refunds | Stop the experiment and return to the known $67 path until the defect is resolved and re-approved |

The sample rule is a **minimum to consider a result**, not a promise that every meaningful price difference can be detected. If the observed variance remains high, the correct answer is “inconclusive,” not forced price selection.

### Price-test reporting row

For each completed Central-time day and each price arm, the operator scorecard should retain only aggregate counts and amounts.

| Field | Example label | Decision use |
|---|---|---|
| Test and arm | `IC-P1-2026-09 / $49` | Cohort integrity |
| Assigned eligible entrants | aggregate count | Primary denominator |
| Exact base Offer ID / price | recorded mapping | Prevents price-only matching |
| Cleared base orders and revenue | Kajabi exact offer | Base conversion/revenue |
| Cleared $199 upgrades and revenue | Kajabi exact offer, tied to base arm | OCUS take rate/revenue |
| Refunds | exact base/upgrade offers | Net-revenue adjustment |
| Checkout starts / page and reader health | first-party/Kajabi health checks | Diagnostic and automatic hold condition |
| Spend, clicks, CPC, CTR | matched Meta delivery only | Upstream stability; arm ROAS allocation |
| Decision status | continue, pause, select, inconclusive | Auditability |

## 3. Experiment B — Klaviyo email path with directly integrated optional SMS

### Current architecture and the critical separation rule

The recovered KO/Klaviyo architecture references the email list `Rrx44Q`, review flow `YyFZPu`, source-flow reference `VMpbLV`, and a distinct Klaviyo treatment page. The present live canvas cannot be treated as verified because the browser session again resolved to a blank/loading state rather than exposing trigger, filter, and message status.[7]

The current Content Hub `interconnectedRouter` is **not an isolated KO test entry point**: it sends a successful submission to Kajabi’s SP26 trigger form and tag, then pushes the same profile to Klaviyo. It also sends a Lead event. Running a Klaviyo test through that shared endpoint would make a lead part of both paths and make the attribution unusable.[8]

Therefore, a Klaviyo/SMS test requires a separately labeled entry route or a verified native Klaviyo form that does **not** submit the contact to the Kajabi form/tag sequence. It must use a distinct `funnel_path=klaviyo_sms_v1` record and never appear in the Kajabi price-test numerator or denominator.

### Consent standard

The existing Klaviyo helper correctly keeps the email list and optional SMS list separate: it adds an Interconnected profile to email list `Rrx44Q`, but it calls the SMS subscription endpoint only when `smsConsent` is true, a phone is provided, and an SMS list ID is configured.[9] This contract should be preserved and strengthened through verification—not bypassed.

Klaviyo’s published guidance states that a phone number or email consent is **not** SMS consent; SMS consent must be explicit, separate, and optional. Disclosure language should appear immediately above the separate SMS checkbox, and any U.S. shopping-cart-abandonment use requires double opt-in.[10] Klaviyo also requires SMS to be enabled with an eligible sending number before consent can be collected.[10]

| Form element | Required design | Prohibited design |
|---|---|---|
| Email | Standalone email consent/entry field; the flow works without a phone | Requiring a phone to receive the series |
| Phone | Clearly labeled optional field, validated for supported country/format | Treating a phone field as marketing consent |
| SMS checkbox | Separate, **unticked**, optional checkbox that names SMS marketing | Prechecked, combined email/SMS, or general “marketing” consent |
| Legal disclosure | Visible above the SMS checkbox; identifies brand, recurring marketing texts, consent-not-required statement, message/data-rate language, and Terms/Privacy links as approved by counsel | Hidden, after-submit, or ambiguous disclosure |
| Flow condition | Send an SMS only if channel status is `SUBSCRIBED` **and** the exact SMS-consent condition is true | Sending because phone is present or profile property merely exists |

### Validation sequence — no subscriber action until approved

The first objective is not to optimize copy or revenue; it is to prove that the path works and that non-consented people cannot receive SMS. Each test below requires separate owner approval before any form submission, profile creation, subscription action, or message delivery.

| Step | Controlled action once approved | Required evidence | Automatic no-go |
|---|---|---|---|
| **K0 — canvas and setup audit** | Read-only review of trigger list, individual message state, filters, SMS sending number, opt-in mode, and checkout links | Flow screenshot/export plus list/flow/version mapping | Blank/unverifiable canvas, unknown trigger, an active unreviewed message, missing sending number, or unknown opt-in mode |
| **K1 — email-only seed** | One approved staff-owned email seed with no phone/SMS consent | Profile enters `Rrx44Q`; correct flow entry and Day 0 path are shown; no SMS subscription/send appears | No flow entry, wrong sequence, wrong Thank You/checkout link, or a duplicate Kajabi enrollment |
| **K2 — phone-without-consent seed** | One approved staff-owned email plus phone, SMS checkbox left false | Email path works; phone may be stored as contact data; channel status remains non-subscribed; zero SMS delivery | Any SMS subscription, queue entry, or SMS delivery without explicit consent |
| **K3 — explicit-SMS-consent seed** | One approved staff-owned email/phone with checkbox affirmative and disclosure visible; follow the configured confirmation step | Consent source, timestamp, form version, and channel status are visible; only the consented seed reaches SMS branch | Missing disclosure evidence, unsupported number/country, subscription failure, incorrect double-opt-in handling, or wrong message branch |
| **K4 — limited live pilot** | A separately approved, non-overlapping new KO cohort with fixed volume and no Kajabi price-test assignment | Aggregate email/SMS delivery, click, checkout, opt-out, and order data with correct source keys | Any path leakage into Kajabi, unconsented SMS, mixed attribution, elevated complaints, or checkout failure |

K0 is currently blocked: the Klaviyo canvas is not visibly inspectable, so no test message, live traffic, SMS enrollment, or flow activation should be proposed until the actual flow state can be confirmed.

### Attribution contract and reporting isolation

Every KO test message and checkout link should preserve a channel- and message-specific attribution key.

```text
funnel_path   = klaviyo_sms_v1
funnel_version = KO-SMS-1
utm_source    = klaviyo
utm_medium    = email | sms
utm_campaign  = interconnected_ko_sms_validation_v1
utm_content   = <flow_version>_<message_key>_<branch>
```

The current historical Klaviyo research supports random flow splits for a single variable, such as message timing or content, but recommends not treating a Kajabi-versus-Klaviyo comparison as a single A/B split because platforms and checkouts differ.[11] For this sprint, do not test SMS copy, timing, and channel at once. First validate K1–K3. If K4 is approved, email remains the baseline and the only experimental difference for the explicitly consented subset is the predeclared SMS branch or timing.

KO/Klaviyo performance reports must remain separate from the Agora Kajabi price-test report. If the KO path uses Shopify checkout, its confirmed Shopify orders are reported as **KO direct order revenue** with its own cohort window; they are not added to Kajabi direct ROAS and are not used to claim a price-test win. Open rate is never a winner metric because it can be distorted by mailbox privacy behavior.[11]

## 4. Sequencing and scale reconciliation

No dollar should be added to Agora while a price change, checkout change, and messaging/SMS change are all in motion. The safe order is below.

| Order | Workstream | Exit condition before the next step |
|---:|---|---|
| 1 | **Read-only readiness** | Exact offer/checkout and $199 equivalence are mapped; K0 Klaviyo canvas checklist is complete; all public routes render; no tracking outage |
| 2 | **Kajabi price-test preparation** | Owner approves exact offers, displayed-price treatment, sticky allocation, reporting mapping, and refund treatment |
| 3 | **P1 $49 vs $67** | P1 has a mature outcome or documented inconclusive result; no concurrent copy, creative, audience, landing, OCUS, or budget change |
| 4 | **P2 champion vs $99** | P2 has a mature outcome or documented inconclusive result under the same controls |
| 5 | **Klaviyo/SMS seed validation** | K1–K3 pass with zero cross-enrollment and zero unconsented SMS; this remains separate from price-test traffic |
| 6 | **Optional KO limited pilot** | Owner approves exact cohort, flow/version, message, consent disclosure, checkout, volume, and stop rules |
| 7 | **Return to scale review** | A selected/retained price has held in a fresh 72-hour baseline window, direct Kajabi gates pass, and price-test/KO reports remain cleanly separated |

The existing $4.7K/day ladder remains valid as a **future capacity model**, but it is now subordinate to this CRO sprint. It cannot begin its first promotion step merely because the matured blended ROAS is 1.2362x. The immediate scale gates still use direct Kajabi cleared revenue, CPC, CTR, base conversion, $199 take rate, and a minimum 25-base-buyer window.[1]

Before any later scale recommendation, require all of the following:

1. The selected Kajabi price (or retained $67 after an inconclusive result) has a completed mature test readout and then passes a fresh, unchanged 72-hour baseline.
2. The current exact-offer Kajabi reader has been expanded and verified to cover the active price arm and its equivalent $199 OCUS, with refunds reconcilable.
3. The immediate promotion gates in the controlled scale plan all pass; neither a price-test statistic nor a Klaviyo metric can substitute for them.
4. K0–K3 Klaviyo integrity validation has passed **if** that path will be used, but KO revenue remains separate from Agora/Kajabi revenue.
5. The verified $5,188 downstream Shopify contribution remains a 14-day mature-cohort validation only. It does not excuse a same-day checkout failure or a weak direct Kajabi price arm.[12]

## 5. Owner approval checklist for implementation

No implementation is authorized by this plan. The following decisions should be confirmed in discrete action groups so that price, consent, and spend changes remain reversible and auditable.

| Approval group | Exact action to approve | Explicitly excluded without another approval |
|---|---|---|
| **A — price-test build** | Create three named Kajabi Offers for $49/$67/$99; map exact Offer IDs; configure identical/omitted $199 OCUS; build fixed price-arm routes and sticky allocation; expand exact-offer reporting | Any change to the active $67 offer, broad page rewrite, price publication, traffic allocation, audience/creative/budget change |
| **B — price-test activation** | Turn on P1’s exact 50/50 $49/$67 allocation for a named start/end window | P2, $99 routing, coupon creation, Meta budget increase, changes to creative/audience/destination |
| **C — Klaviyo audit/QA** | Inspect K0 and perform one named seed step at a time using only owner/staff-controlled test contacts | Subscriber import, production list enrollment, public flow activation, live campaign/message send |
| **D — KO live pilot** | Route a named fixed-volume, non-overlapping new KO cohort to the approved email/SMS flow and checkout path | Enrollment of existing subscribers, Kajabi price-test traffic, Meta spend/budget/campaign changes, automatic SMS opt-in |
| **E — scale decision** | Make one specified ladder adjustment after all CRO and direct Kajabi gates pass | Any multi-rung jump, parallel variables, VIBE pooling, use of Meta purchase value, or use of unresolved Shopify revenue |

## 6. Bottom line

The right next move is to **tighten measurement and conversion mechanics before scale**. Start with price readiness, then run a disciplined $49-versus-$67 read before confronting the winning price with $99. In parallel, treat the Klaviyo-plus-SMS work as a consent-and-path-integrity validation—not as another source of headline ROAS. The price test proves the best Kajabi entry economics; the Klaviyo test proves that an optional-SMS route is safe and attributable. Only after both are clean should the Agora budget ladder resume.

**Basis:** Direct price-test revenue means exact-offer Kajabi cleared base and equivalent $199 upgrade revenue, less reconciled refunds, per assigned eligible entrant. Meta supplies delivery/spend only.  
**Time:** Existing context is through September 4, 2026; all operating windows use America/Chicago completed calendar days.  
**Assumptions:** The three price arms offer the same product access and can present an equivalent $199 upgrade path; if either assumption fails, the price test does not start.  
**Sources and confidence:** Current architecture is confirmed from the listed internal contracts; live Klaviyo canvas state is **not verified** because it did not render in the read-only session.  
**Compliance:** This is research and operating analysis only, not personalized financial advice. SMS disclosure and opt-in implementation should receive counsel review before production use.

## References

[1]: ./agora-controlled-scale-plan-2026-09-04.md "Agora controlled-scale plan"

[2]: ./agora-199-ocus-take-rate-and-break-even-2026-09-04.md "Kajabi-only $199 OCUS economics"

[3]: ../server/kajabiSalesRouter.ts "Exact $67 and $199 Kajabi reporting contract"

[4]: https://help.kajabi.com/articles/sales/checkout/can-i-create-an-offer-checkout-page-with-different-pricing "Kajabi: create an offer checkout page with different pricing"

[5]: https://help.kajabi.com/articles/website/pages/landing-page-ab-testing-overview "Kajabi: landing-page A/B testing overview and attribution limits"

[6]: ../server/abTestRouter.ts "Existing weighted sticky-assignment infrastructure"

[7]: ./interconnected-klaviyo-optin-readiness-audit-2026-09-02.md "Interconnected Klaviyo opt-in readiness audit"

[8]: ../server/interconnectedRouter.ts "Current shared Kajabi and Klaviyo registration flow"

[9]: ../server/klaviyo.ts "Interconnected email-list and optional-SMS subscription contract"

[10]: https://help.klaviyo.com/hc/en-us/articles/360035056972 "Klaviyo: understanding SMS consent collection"

[11]: https://help.klaviyo.com/hc/en-us/articles/360049849432 "Klaviyo: how to A/B test flow branches"

[12]: ./agora-blended-first-party-roas-2026-09-04.md "Conservative first-party blended Agora ROAS"
