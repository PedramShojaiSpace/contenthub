# Interconnected Klaviyo CRO Research — 2026-08-12

## Verified Klaviyo Capabilities

Klaviyo supports flow-level A/B testing using a **Random sample** split. The split should be placed where the test begins, with a 50/50 allocation for a true A/B test. Klaviyo recommends changing one variable at a time and selecting the winner from conversion-relevant flow analytics rather than opens alone. [1] [2]

Klaviyo's default attribution windows for accounts created after 2024-10-09 are 5 days for email and SMS and 24 hours for push, although account settings can change those windows. Attribution can credit the last eligible engaged channel, so it should be treated as a closing-touch view rather than an acquisition-credit view. [3]

Klaviyo automatically appends `_kx` to message links for known-browser tracking. It also supports global and message-level UTM rules. The current default UTM medium is message type, making email/SMS separation available in downstream analytics. [3] [4]

## Implications for the Klaviyo Treatment

1. Keep Kajabi untouched and encode the treatment path in UTMs: `utm_source=klaviyo`, `utm_medium=email` or `sms`, `utm_campaign=interconnected_67_treatment`, and a `utm_content` that identifies the exact message or variant.
2. Use the existing first-party `/r/checkout` bridge for Shopify checkout links so the Content Hub can preserve direct click-to-purchase attribution in addition to Klaviyo reporting.
3. Use a random split only inside the Klaviyo treatment flow. Do not randomize across Kajabi and Klaviyo because the platforms, sender reputation, and checkout experiences differ. Kajabi remains the external control cohort rather than a strict A/B branch.
4. Evaluate: confirmed Shopify revenue per delivered recipient, checkout conversion, $67 conversion per eligible lead, $199 attach rate among $67 buyers, unsubscribes, and direct tracked-click revenue. Treat Klaviyo-attributed revenue and Content Hub lead-cohort acquisition credit as separate, non-additive lenses.

## Sources

[1] https://help.klaviyo.com/hc/en-us/articles/360049849432 — How to A/B test flow branches.
[2] https://help.klaviyo.com/hc/en-us/articles/360054629031 — Understanding what to A/B test in your flows.
[3] https://help.klaviyo.com/hc/en-us/articles/115005248128 — Understanding message conversion tracking.
[4] https://help.klaviyo.com/hc/en-us/articles/115005247808 — Understanding UTM tracking in Klaviyo.

## Shopify Checkout Handoff Evidence

Shopify officially supports cart permalinks that pre-load a selected variant and take buyers directly to a store cart or checkout. The URL may also carry `attributes`, `note`, or `ref` conversion-tracking parameters; these values are retained on the order. This allows the $67 Thank You B decision page to send a buyer directly into a pre-filled Shopify checkout rather than detouring through a generic product page. [5] [6]

For the mapped $67 variant, the intended format is `https://shop.theurbanmonk.com/cart/48959577653402:1`, wrapped by the existing first-party checkout bridge so the UTM values and `_um_click_token` order attribute are preserved. Do not use `storefront=true`, which deliberately redirects a buyer to the cart page instead of checkout. A paid product and live Online Store availability remain prerequisites for checkout completion.

[5] https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks — Create cart permalinks.
[6] https://help.shopify.com/en/manual/checkout-settings/cart-permalink — Cart permalinks.

## Correction: Thank You B Is the $67 Decision Page

The verified live decision page is `https://content.theurbanmonk.com/interconnected/thank-you-b`, not the Shopify product page. It currently contains the $67 all-access offer, a 15-minute persistent timer, the Version B Wistia video, the documented value stack, above-fold CTA, Meta `InitiateCheckout`, and internal A/B checkout-start tracking. Its present CTA redirects to the Kajabi offer checkout at `https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout`.

Therefore, the **Klaviyo treatment must preserve Thank You B as the sales page**. It should be a separately labeled Klaviyo treatment clone or route that retains the current decision-page structure and changes only the checkout handoff after approval. Kajabi stays completely unchanged as the control.

### Corrected $67 Treatment Flow

```text
Klaviyo opt-in → Klaviyo Thank You B treatment page → tracked Shopify cart permalink → native Shopify checkout → confirmed Shopify paid order
Kajabi opt-in  → existing Kajabi Thank You B/control page → existing Kajabi checkout → existing Kajabi order
```

The treatment checkout should **not** send the buyer to a Shopify product-detail page. It should use a pre-filled direct Shopify checkout link for the $67 variant, wrapped in the Content Hub's existing `/r/checkout` tracking bridge. This gives the buyer one product, one quantity, and native checkout, with no product-page navigation, search, collection, or cart detour. Shopify documents cart permalinks specifically for curated checkout experiences with preloaded variants and conversion attributes. [5] [6]

### Corrected Experiment Sequence

| Priority | What changes | What does not change | Success measure |
|---:|---|---|---|
| 1 | Create a Klaviyo-only Thank You B treatment route that sends its $67 CTA to a tracked direct Shopify checkout | Current Kajabi Thank You B page, Kajabi checkout, price, value stack, timer length, and paid traffic to Kajabi control | Confirmed $67 Shopify orders per eligible Klaviyo lead |
| 2 | Test one Thank You B decision-page variable, beginning with the above-fold video/CTA framing or placement | Checkout handoff, price, value stack, email cadence | Confirmed $67 order rate and checkout-start-to-paid rate |
| 3 | Add a Klaviyo clicked-but-not-paid recovery message that returns to the same treatment route | Offer, price, and Kajabi control | Recovered $67 orders per clicked non-buyer |
| 4 | After a confirmed Shopify $67 order, begin the $199 post-purchase treatment | $67 treatment and Kajabi control | $199 paid orders per confirmed $67 buyer |

### Page-Integrity Guardrails

The first Klaviyo treatment does **not** rewrite Thank You B wholesale. It preserves the proven decision-page architecture, then isolates one page variable at a time. The current testimonial/review section should not be copied into a new treatment variation unless the underlying viewer ratings and named statements are verified and authorized; no new testimonials, reviews, ratings, or customer outcomes will be created. The first Shopify test will not alter public product-page visibility, collections, navigation, or the existing Kajabi destination.

## Proposed Klaviyo Treatment Architecture

### Cohort Design

Kajabi remains untouched as the control. New treatment traffic uses an isolated Klaviyo opt-in path and never enters the Kajabi sequence. For comparison, run matched Meta ad-set pairs using the same creative, audience, geography, optimization event, and daily budget. The sole intentional difference is the destination: Kajabi control versus Klaviyo treatment. Label every treatment opt-in with `funnel_path=klaviyo`, `funnel_version=K1`, and the same campaign/ad-set metadata preserved on the existing lead record.

This is a controlled channel comparison, not a within-flow A/B test. The Content Hub should compare 14-day **original-acquisition cohorts** and keep closing-touch reporting separate, so a Klaviyo click does not erase the original Meta or Kajabi/Klaviyo acquisition source.

### $67 Klaviyo Treatment Sequence

The treatment objective is a confirmed $67 Shopify purchase per eligible Klaviyo lead. The first treatment version should use a Klaviyo-only $67 destination built as a funnel landing page rather than the current generic Shopify product-detail page. It should preserve the exact offer and truthful value stack, remove unnecessary storefront navigation, make the post-series reason to act visible above the fold, and use one primary checkout CTA. It must not include a refund guarantee for opened kits.

The proposed message structure is: an immediate email with the series-to-offer bridge; an early checkout-intent follow-up only for people who clicked but did not pay; a day-one objection-resolution email; and one close message. SMS is only available where SMS consent is present; links must be shortened through Klaviyo and point to the first-party tracked checkout bridge. The initial test should change the **destination/page context** only, not price, offer, send volume, or message cadence.

### $199 Post-Purchase Treatment

The $199 offer should be triggered only by a confirmed $67 Shopify paid order, never by an email click or an unverified checkout event. The treatment is a Shopify post-purchase checkout path, not a claimed “one-click” Shopify checkout unless a platform-native one-click capability is confirmed. The offer page should state the real regular price and the genuine, time-bounded post-purchase price; include the supplied video; explain the test/health-coach value stack; retain the existing no-refund-on-opened-kit rule; and contain a single checkout CTA.

The initial upsell sequence should be: order receipt first; a short post-purchase delay; the $199 page; one checkout-abandonment message; and a final close message only while the stated offer remains available. The Klaviyo trigger must exclude anyone who has already purchased the $199 SKU, and the Content Hub must record $199 paid orders as a separate attach event against the original $67 purchase.

### Tracking Contract

| Touchpoint | Required labels | Source-of-truth metric |
|---|---|---|
| Klaviyo $67 lead | `funnel_path=klaviyo`, `funnel_version=K1`, campaign and ad-set UTMs | Unique eligible lead |
| $67 message link | `utm_source=klaviyo`, `utm_medium=email` or `sms`, `utm_campaign=interconnected_67_treatment`, message-specific `utm_content`, click token | Tracked click and confirmed Shopify $67 order |
| $199 purchase trigger | Confirmed $67 Shopify paid order and product/SKU condition | Eligible $67 buyer |
| $199 message link | `utm_source=klaviyo`, `utm_medium=email` or `sms`, `utm_campaign=interconnected_199_treatment`, message-specific `utm_content`, click token | Tracked click and confirmed Shopify $199 order |
| Kajabi control | Existing path unchanged; control UTMs preserved | 14-day cohort revenue and conversion |

### Decision Rules

The primary $67 measure is **confirmed $67 paid orders per eligible lead** and the primary $199 measure is **confirmed $199 paid orders per confirmed $67 buyer**. Revenue per eligible lead is the tie-breaker. Do not select a winner from opens, because Mail Privacy Protection can inflate them. [1] [2]

The planned $199 business target is 20% attach rate, but the first milestone is a validated, non-zero baseline with at least 10 paid $199 orders and no material rise in unsubscribe/complaint behavior. For the $67 offer, do not promote a page/message variant as a winner until it has accumulated at least 25 paid $67 orders or has completed a full 14-day cohort window with a clear revenue-per-lead advantage. Stop a treatment early if it produces a sustained 25%+ decline in $67 conversion versus the matched Kajabi control after at least 100 eligible treatment leads, unless higher downstream revenue more than offsets the shortfall.

## Prioritized CRO Experiment Backlog

### Experiment K67-1 — Reframe the $67 Page as the Post-Series Decision Page

**Hypothesis.** The current generic product-detail page loses post-series intent because it looks like a store page, not the next decision in a diagnostic-health journey. The Klaviyo treatment page should replace store navigation, search, and generic product-page hierarchy with the exact post-series context: what the viewer has just learned, what the $67 offer contains, what decision is required now, and one direct checkout action.

| Element | Treatment specification | Guardrail |
|---|---|---|
| Offer | Keep price at $67 and retain the existing truthful product/value stack | Do not change price, add invented scarcity, or introduce a refund promise |
| Page frame | Remove top-store navigation and search; retain minimal footer navigation | Keep accessibility, contact/help, privacy, and required disclosure paths available |
| Above the fold | Series-to-offer bridge, concise value stack, exact price, single CTA | No medical outcome claims beyond approved product language |
| Proof | Use product/process specifics, clinician/coach facts that are verified, and the existing video if relevant | Do not manufacture testimonials, reviews, patient outcomes, or “before/after” claims |
| CTA | “Get the complete protocol for $67” to a tracked Shopify checkout/cart link | Maintain first-party click token and Klaviyo UTM labels |

**Primary outcome:** paid $67 orders / eligible Klaviyo lead. **Secondary outcomes:** checkout click-through rate, checkout-to-paid rate, revenue per eligible lead, unsubscribe rate. **Control:** unchanged Kajabi path. **Start rule:** ship only after the tracking contract and dedicated treatment URLs are live.

### Experiment K67-2 — Clicked-but-Not-Paid Recovery

**Hypothesis.** Leads who click the $67 CTA but do not pay require a concise decision-assistance message, not another full series recap. The treatment should trigger only after a tracked checkout click with no confirmed paid order within the selected delay.

The control branch receives the current treatment-flow cadence. The test branch receives one short email at 45–90 minutes that resolves the single most important remaining question: what the $67 offer is, who it is for, and exactly what happens after checkout. The later test, after K67-2 is read, can compare the same email against an SMS reminder for SMS-consented users; do not test copy, timing, and channel simultaneously. [1] [2]

### Experiment K67-3 — Second-Decision Email

**Hypothesis.** A day-one email focused on the cost of staying uncertain will outperform a second feature-list email. It should use the series narrative to explain why the offer is a practical next step, then return to the same tracked $67 checkout link.

This experiment begins only after K67-1 has been held stable. The test changes the central message angle, while offer, price, delay, CTA, and destination remain identical. The winner is selected by confirmed paid order rate and revenue per recipient — not by opens. [1] [2]

### Experiment K199-1 — Immediate Post-$67 Upsell Page

**Hypothesis.** $199 buyers will respond better when the test-kit and health-coach offer is framed as the logical next diagnostic step after their $67 purchase rather than as an unrelated higher-priced add-on.

| Element | Treatment specification | Guardrail |
|---|---|---|
| Eligibility | Trigger only on a confirmed $67 Shopify paid order | Suppress profiles already holding a confirmed $199 order |
| Page promise | Explain the verified test-kit and health-coach value stack and why it follows the $67 protocol | Do not claim that any test diagnoses, cures, or guarantees a health result unless approved |
| Pricing | Show the real regular price and a genuine $199 post-purchase price | Do not use false comparison pricing or resettable timer language |
| Video | Use the supplied $199 OCU video near the first decision point, with a text summary for visitors who do not play it | Preserve page speed and captions/accessibility where available |
| Checkout | One tracked Shopify CTA; hidden from storefront merchandising | Do not describe Shopify checkout as “one-click” unless it is technically a verified native post-purchase checkout |

**Primary outcome:** paid $199 orders / confirmed $67 buyers. **Secondary outcomes:** upsell-page view-to-checkout rate, checkout-to-paid rate, revenue per $67 buyer, and complaint/unsubscribe rate. **Business target:** 20% attach rate; **first validation milestone:** ten confirmed $199 purchases with correct attribution.

### Experiment K199-2 — Post-Purchase Timing

**Hypothesis.** A short delay after the $67 order confirmation will outperform an immediate interruption because it lets the buyer complete the first decision before considering the diagnostic next step. This is a pure timing test: same $199 page, same video, same message, and same price; random-split the eligible $67 buyer cohort between the immediate and delayed routes. [1] [2]

### Experiment K199-3 — Checkout-Abandonment Rescue

**Hypothesis.** Buyers who reach the $199 checkout but do not pay will convert better with one simple recap of what is included and what happens after purchase than with a repeated urgency message. Trigger after a verified tracked $199 checkout click with no paid order, suppress at purchase, and do not add a discount in the first test.

## Recommended Sequence

| Order | Experiment | Why it comes first |
|---:|---|---|
| 0 | Instrument treatment tags, tracked checkout links, and purchase suppressions | Ensures the Klaviyo treatment can be compared to Kajabi without contaminating attribution |
| 1 | K67-1 | Fixes the most obvious on-page mismatch before changing message volume or offer mechanics |
| 2 | K67-2 | Converts existing high-intent clickers while K67-1 page remains stable |
| 3 | K199-1 | Establishes a real, measurable $199 Shopify treatment only after the $67 purchase signal is clean |
| 4 | K199-2 | Improves timing after a reliable $199 baseline exists |
| 5 | K67-3 and K199-3 | Tests message angle and abandonment recovery one variable at a time |

## Implementation Preconditions

The $199 Shopify treatment must be purchasable before it can be tested. It may stay excluded from storefront navigation, search, and collections, but a Draft Shopify product cannot support a live treatment checkout. The correct implementation is an approved, controlled purchase path with explicit storefront-visibility protections; no Shopify visibility or URL change should be made without separate approval.
