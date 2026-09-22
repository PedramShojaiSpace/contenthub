# Interconnected: Kajabi Checkout with Klaviyo Buyer Lifecycle

**Author:** Manus AI  
**Date:** 22 September 2026  
**Status:** Scope and architecture only. No Kajabi offer, checkout, upsell, landing page, webhook, Klaviyo flow, email, SMS, tracking, page, price, traffic, or advertising setting was changed.

## Executive recommendation

The proposed funnel is technically sound and is the cleanest way to preserve the **Kajabi-native $199 one-click upsell** while moving paid-buyer education, segmentation, and long-term nurture into **Klaviyo**.

The core design is simple:

> **Interconnected front-end page → Kajabi $67 or $99 checkout → Kajabi-native $199 upsell page with video → Kajabi course access → Content Hub purchase receiver → dedicated Klaviyo buyer event → Klaviyo paid-buyer lifecycle.**

Kajabi remains the financial and entitlement authority. It processes the front-end purchase, presents the native one-click upsell, and grants product access. Klaviyo becomes the communication authority for marketing-consented buyers after purchase. The Content Hub is the controlled bridge: it receives a signed Kajabi purchase event, records the transaction, attributes it to the correct source path, creates a deduplicated Klaviyo buyer event, and suppresses messages that no longer apply.

This avoids the weak point in the Shopify path: the buyer never needs to leave the post-purchase flow for a separate checkout. It also avoids a second weak point: a Kajabi email sequence does not provide the same buyer segmentation, event reporting, and long-term lifecycle control as Klaviyo.

## Current assets and boundaries

The currently published `interconnected.theurbanmonk.com` root and episode routes are **private screening pages**. They require an email-activated browser session and are unsuitable as paid-buyer library pages. They can remain the pre-purchase screening experience, provided the paid CTA is changed to the appropriate Kajabi checkout route.

Kajabi can send a purchaser to an offer-specific **Kajabi landing page** after checkout. It cannot select an arbitrary external Content Hub page as that post-purchase destination. Therefore the immediate post-purchase orientation page must either be a Kajabi landing page or remain Kajabi’s native post-purchase surface. [1]

The existing Kajabi buyer sequence, `[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99`, is not the recommended live delivery vehicle for this architecture. It is useful as a copy and timing repository, but the live lifecycle should be rebuilt as a Klaviyo metric-triggered flow so that it is driven by a verified purchase event and has measurable exits.

## Recommended buyer journey

| Stage | System of record | Buyer experience | Required control |
|---|---|---|---|
| 1. Paid screening | Interconnected front-end pages | Watches screening content and clicks the paid CTA | Preserve existing first-party lead and UTM capture. |
| 2. Checkout | Kajabi | Completes either the $67 control or $99 treatment checkout | Use distinct offer IDs and tagged checkout-start records. |
| 3. Immediate upgrade | Kajabi | Sees the video-led $199 native one-click upsell | Keep the video, offer, price, and upsell design identical across $67/$99 arms unless intentionally tested. |
| 4. Access and orientation | Kajabi | Receives course entitlement and reaches a Kajabi post-purchase orientation page | The access message must be a Kajabi product/transactional communication, not a marketing-flow substitute. |
| 5. Buyer handoff | Content Hub | No added customer-facing step | Signed Kajabi purchase webhook records the qualifying base purchase and sends one buyer event to Klaviyo. |
| 6. Buyer lifecycle | Klaviyo | Receives the paid-buyer email path only if marketing-eligible | Do not infer email or SMS consent. Exclude from free-screening emails after purchase. |
| 7. Testing / Academy handoff | Klaviyo + Kajabi | Receives relevant next-step invitations after engagement | Suppress the $199 recovery when the Kajabi OCU is accepted; route test buyers to fulfillment. |

## The Kajabi checkout and upsell layer

The paid CTA from the Interconnected screening pages should first pass through a Content Hub checkout-start bridge. The bridge writes the source context and then redirects to one of two Kajabi offer checkouts:

| Arm | Kajabi offer | Offer ID | Required source label |
|---|---|---:|---|
| Control | Interconnected $67 | `2151314475` | `kajabi_klaviyo_67_v1` |
| Price treatment | Interconnected $99 | `2151402817` | `kajabi_klaviyo_99_v1` |

The existing Kajabi-native $199 one-click upsell should remain within each offer’s **Purchase flow**. It is the correct place for the video-led presentation because it preserves the saved-payment one-click action. The two base-price offers should use the same $199 upsell page, product, price, and fulfillment unless the upsell itself becomes a separately declared test.

After the buyer accepts or declines the one-click offer, Kajabi should direct them to a dedicated Kajabi landing page named, for example, **`Interconnected — You’re In`**. This page should include the course-access instruction, a calm “start here” orientation, the paid-library button, and a brief explanation of what happens next. It should not re-sell the $199 option that the buyer just considered.

## The purchase-to-Klaviyo bridge

Kajabi supports offer-level **Purchase Created** webhooks and site-level **Payment Succeeded** webhooks. Purchase Created is the correct base-buyer trigger because it fires on the first payment for a one-time offer, subscription, or payment plan. Payment Succeeded should be retained for reconciliation and for tracking later OCU/renewal payments, but it must not start the buyer lifecycle by itself. [2] [3]

The current Content Hub already has a signed Kajabi purchase receiver at `/api/kajabi/purchase`. It verifies the raw payload before processing, records a deduplicated Kajabi purchase, assigns a funnel source, creates first-party cohort credit, and sends the existing Meta Purchase diagnostic event. The scoped addition is a **Klaviyo buyer-event adapter**, not a new external service.

For an eligible base purchase, the adapter should create exactly one Klaviyo event:

| Event property | Purpose |
|---|---|
| `event_name` = `Interconnected Kajabi Buyer` | Dedicated, human-readable metric for the lifecycle flow. |
| `purchase_key` | Stable Kajabi transaction identifier for idempotency. |
| `offer_id` and `offer_tier` | Distinguishes $67 control from $99 treatment. |
| `entry_platform` = `kajabi` | Keeps Kajabi revenue distinct from the Shopify challenger ledger. |
| `funnel_path` | Records the exact page/CTA route, e.g. `kajabi_klaviyo_67_v1`. |
| `base_revenue_cents` | Preserves base-sale reporting without treating the OCU as base revenue. |
| `upsell_status` | Initially `pending`; later updated through a separate event/property if the Kajabi OCU settles. |
| `paid_course_key` | Makes the entitlement and buyer type auditable. |

Klaviyo supports custom API events as metric-triggered flow sources. A metric-triggered flow can use event properties as trigger filters and profile properties as flow filters. [4] [5]

The adapter must **not** add the buyer to the existing free-screening list. It must not subscribe the buyer to SMS. It must not infer email marketing consent. It only creates the purchase event and updates permitted buyer-status profile properties.

## Klaviyo flow architecture

Create a new flow named:

> **`[DRAFT] Interconnected Kajabi Buyer Lifecycle — Event Trigger`**

The trigger is the custom metric `Interconnected Kajabi Buyer`. Its trigger filter allows only offer IDs `2151314475` and `2151402817`. A flow filter prevents re-entry for an already active purchase key. A second filter prevents marketing sends to profiles without email marketing eligibility.

| Timing | Klaviyo action | Required gate |
|---|---|---|
| Immediately | Do not replace Kajabi’s access/entitlement message. Record buyer event and profile state only. | The transactional access path must work independently of Klaviyo marketing consent. |
| +30 minutes | Optional $199 recovery email | Send only if the Content Hub has not received the corresponding Kajabi OCU purchase/updated total and the profile is email-marketing eligible. |
| Day 1 | Paid orientation | Use the paid Kajabi course route; no free-screening language. |
| Day 3 | Series activation | Continue the paid course. |
| Day 6 | Protocol engagement | Only when the underlying asset is published and buyer-accessible. |
| Day 9 | Testing education | Link to the approved $199 member-testing destination; exit if the buyer has already acquired it. |
| Day 13 | Live or evergreen education | Use a verified current registration or replay destination only. |
| Day 17 | Decision support | Buyer-specific next-step hub or approved alternative. |
| Day 24 | Re-engagement | Return to paid course / guide. |
| Day 30 | Core funnel / Academy handoff | Use the verified next live education or Academy pathway. |

The current free-screening Klaviyo flow must receive a purchase exit. A buyer who converts on Kajabi should stop receiving “free screening” framing immediately. The paid-buyer flow must also exit when a qualifying $199 test purchase occurs, handing off to the existing test fulfillment sequence.

## Revenue, attribution, and measurement

The same named source path must appear in the checkout-start record, buyer event, first-party purchase credit, and reporting view. This creates an independent `Kajabi + Klaviyo` path that can be compared cleanly with the current `Kajabi + Kajabi Email` control and the `Klaviyo + Shopify` challenger.

| Metric | Authority | Definition |
|---|---|---|
| Base buyer and base revenue | Kajabi purchase record | Paid, non-refunded $67/$99 offer purchase. |
| OCU attach rate | Kajabi transaction / payment event | $199 OCU transactions divided by eligible base buyers. |
| Buyer activation | Klaviyo | Paid-library or paid-episode click within 72 hours. |
| Testing progression | Kajabi/Shopify based on final destination | Qualified $199 member-offer purchase after the base offer. |
| Booked ROAS | First-party revenue ÷ destination-tagged Meta spend | Use Kajabi cleared revenue for this path; Meta Purchase value is diagnostic only. |
| Lifecycle influence | Klaviyo event and click reporting | Report separately from booked revenue; do not treat an open as a sale. |

## Viable ways to implement it

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---|
| **A. Kajabi checkout + Kajabi OCU + Content Hub → Klaviyo event flow** | Preserves the strong Kajabi video OCU; gives Klaviyo full lifecycle control and clean event-level reporting; keeps transaction and entitlement authority in Kajabi. Requires a scoped webhook/event adapter and a new draft Klaviyo flow. | Existing platform capacity | Moderate |
| **B. Kajabi checkout + Kajabi OCU + Kajabi buyer sequence** | Fastest because the draft Kajabi sequence already exists. Less clean measurement, weaker suppression logic for the OCU, and a second system for buyer lifecycle reporting. | Existing platform capacity | Lower |

Approach A is the architecture that best fits the stated goal: **Kajabi closes the sale and handles the one-click upsell; Klaviyo owns the buyer relationship after a confirmed purchase.**

## Required pre-build decisions and approval gates

1. Confirm whether the existing Kajabi $199 OCU already uses the desired video page for both base offers. If it does not, finalize that configuration in draft before moving traffic.
2. Create or identify the Kajabi post-purchase landing page. The current `interconnected.theurbanmonk.com` screening pages cannot be used as this page because they are external and screening-gated.
3. Confirm the access-delivery mechanism and course entitlement experience for both $67 and $99 offers.
4. Choose the buyer lifecycle destinations that remain unresolved: protocol, companion guide, masterclass, webinar/evergreen event, community, and buyer next-step hub.
5. Approve a new custom Klaviyo metric, a new draft flow, and the exact control/treatment source labels.
6. Approve one controlled internal test for each offer and one accept/decline Kajabi OCU scenario. No paid traffic should be redirected until this proves one buyer event, one lifecycle enrollment, correct access, correct suppression, and correct revenue ledger entry.

## Explicitly out of scope until approval

This scope does not create, activate, modify, or publish an offer, upsell, landing page, redirect, webhook, Klaviyo flow, email, SMS, product access setting, checkout, ad, budget, or traffic allocation. It also does not change the current Shopify/Klaviyo or Kajabi control arms.

## References

[1]: https://help.kajabi.com/articles/sales/offers/how-to-send-customers-to-a-landing-page-after-checkout "Send customers to a landing page after checkout"

[2]: https://help.kajabi.com/articles/api-integrations/webhooks/webhooks-explained "Use webhooks with Kajabi"

[3]: https://help.kajabi.com/articles/api-integrations/webhooks/what-information-is-sent-with-outbound-webhooks "Outbound webhook data reference"

[4]: https://help.klaviyo.com/hc/en-us/articles/360003057151 "How to create a metric-triggered flow"

[5]: https://developers.klaviyo.com/en/docs/custom_event_tracking "Track API metrics with JavaScript"
