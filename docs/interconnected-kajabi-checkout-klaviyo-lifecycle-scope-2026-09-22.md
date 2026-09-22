# Interconnected: Kajabi Checkout, $99 Upstream OCU, and Klaviyo Buyer Handoff

**Author:** Manus AI  
**Date:** 22 September 2026  
**Status:** Revised architecture and staged implementation plan. No live checkout, offer, upsell, landing page, webhook, Klaviyo flow, email, SMS, tracking, traffic, or advertising setting has been changed by this scope.

## The decision

Use **Klaviyo to nurture the lead**, **Kajabi to take payment and fulfill the digital product**, and the existing Content Hub webhook receiver to tell Klaviyo when a lead has become a buyer.

The immediate upgrade is no longer testing. The Kajabi one-click upsell is the **Upstream Course at a one-time $99 price**, with $199 as the regular standalone price. This is the correct post-purchase offer because it is digital, high-margin, and aligned with the Interconnected education journey.

> **Klaviyo lead flow → tracked Kajabi $67 or $99 checkout → Kajabi-native $99 Upstream Course OCU → Kajabi fulfillment → signed purchase webhook → Klaviyo buyer event.**

A lead who does not buy continues normally through the existing Klaviyo lead flow. A confirmed buyer leaves the prospect logic and enters a buyer-specific Klaviyo flow. Kajabi continues to deliver the purchased products and access; Klaviyo must not become the course-entitlement system.

## The clean handoff in plain English

1. **Keep the existing Klaviyo email sequence.** Its delayed Day 0 offer, education, and episode cadence remain the prospect experience.
2. **Replace only the first-product checkout links.** The $67 and $99 CTAs point to their respective Kajabi offer checkout URLs through the existing Content Hub tracking bridge.
3. **Let Kajabi do the conversion work.** The $67/$99 purchaser receives the $99 Upstream Course native one-click upsell with the video-led Kajabi presentation.
4. **Let Kajabi fulfill.** Kajabi grants Interconnected and—if accepted—Upstream Course access, then sends its normal fulfilment communication.
5. **Use the existing signed webhook.** Kajabi sends a Purchase Created event to `https://content.theurbanmonk.com/api/kajabi/purchase` after a successful base purchase.
6. **Send a single Klaviyo buyer event.** The Content Hub creates `Interconnected Kajabi Buyer` for that confirmed base purchase. That event triggers the buyer flow and prevents further prospect messaging.
7. **Track the OCU separately.** An accepted $99 Upstream Course purchase sends `Upstream Course OCU Accepted`. It is not a testing purchase and it must not start the buyer flow a second time.

## Exact system responsibilities

| System | Owns | Does not own |
|---|---|---|
| **Klaviyo** | Lead nurture, buyer segmentation, buyer education, lifecycle messaging, event reporting, prospect suppression | Payment, course access, OCU checkout, inferred SMS consent |
| **Kajabi** | $67/$99 checkout, $99 Upstream Course OCU, payment confirmation, product access, transactional/access delivery | Lead source attribution beyond the supplied checkout path, long-term buyer marketing segmentation |
| **Content Hub** | Signed webhook verification, one-per-purchase buyer event, offer/tier classification, first-party ledger, source attribution, deduplication | Customer-facing course fulfillment |

## The checkout links to use

The existing tracker already supports a Kajabi destination. Each Klaviyo button should call the current first-party bridge, then redirect to the specific Kajabi offer.

| Arm | Exact Kajabi offer | Checkout URL | Recommended tracking label |
|---|---:|---|---|
| $67 control | `2151314475` | Confirm existing live $67 checkout URL before replacing buttons | `kajabi_klaviyo_67_v1` |
| $99 treatment | `2151402817` | `https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout` | `kajabi_klaviyo_99_v1` |

The tracker link takes this form:

```text
https://content.theurbanmonk.com/r/checkout?destination=<URL-ENCODED_KAJABI_CHECKOUT>&utm_source=klaviyo&utm_medium=email&utm_campaign=interconnected_14day&utm_content=<MESSAGE_KEY>&funnel_path=kajabi&email_key=<MESSAGE_KEY>
```

The `destination` must be the exact Kajabi checkout URL. The `email_key` must be stable per message so the ledger can report the source email that created the checkout start.

## The Kajabi setup

The live Kajabi offer map confirms the $67 and $99 front-end offers. It does **not** yet show an exact paid $99 Upstream Course offer or a confirmed new OCU identifier. The only currently discoverable matching Upstream offer is a $0 limited-access offer. That is expected while the new course offer is being built, but it means the connection must not guess at the new OCU ID.

Create or finish these **draft Kajabi records**:

| Item | Required configuration |
|---|---|
| **Upstream Course Product** | The actual Kajabi course product that grants the $199 standalone course access. |
| **Upstream Course – Standard Offer** | One-time $199 offer tied to the Upstream Course product. This is the standalone sales-page offer. |
| **Upstream Course – Interconnected OCU** | One-time $99 offer tied to the same Upstream Course product. This is restricted to the post-purchase offer and should not be the default public sales-page checkout. |
| **$67 Interconnected Purchase Flow** | The current $99 Upstream Course offer added as its only native one-click upsell. |
| **$99 Interconnected Purchase Flow** | The same $99 Upstream Course offer added as its only native one-click upsell. |
| **Post-purchase landing page** | A Kajabi buyer orientation page after accept or decline. It should contain access guidance and a paid-library button, not another upsell. |

The current `interconnected.theurbanmonk.com` routes remain screening-gated. They are suitable for the opt-in and email-screening experience, but they are not the post-purchase access page. Kajabi’s post-purchase selector directs buyers to a Kajabi Landing Page. [1]

## The webhook and Klaviyo events

The Content Hub already has a live signed receiver at:

```text
https://content.theurbanmonk.com/api/kajabi/purchase
```

Kajabi should send **Purchase Created** there for the base $67/$99 offers. This is the best trigger because it represents a one-time offer purchase or first payment, and therefore starts the buyer lifecycle only once. [2]

The receiver already verifies the request, normalizes Kajabi’s purchase data, de-duplicates by the stable transaction ID, records the Kajabi purchase, and assigns Interconnected cohort credit. The Klaviyo event adapter is now **implemented in a disabled state** and is covered by focused regression tests. It has no effect until the two explicit activation settings below are present.

| Incoming confirmed purchase | Klaviyo result | Reason |
|---|---|---|
| $67 base offer `2151314475` | `Interconnected Kajabi Buyer` | Starts the buyer flow once. |
| $99 base offer `2151402817` | `Interconnected Kajabi Buyer` | Starts the same buyer flow once with the treatment label. |
| $99 Upstream Course OCU | `Upstream Course OCU Accepted` | Updates buyer status and suppresses future Upstream promotion; does not re-enroll the buyer flow. |
| Any other Kajabi purchase | No Interconnected buyer event | Keeps unrelated Kajabi revenue and lifecycle paths separate. |

Klaviyo’s Events API allows a server-side custom metric tied to the buyer’s profile. Its `unique_id` prevents a duplicate delivery of the same Kajabi transaction from creating another event. [3]

The event payload will be non-sensitive and include only the buyer email/name necessary for Klaviyo identification plus the purchase classification:

```text
Interconnected Kajabi Buyer
  purchase_key: <Kajabi transaction ID>
  base_offer_id: 2151314475 or 2151402817
  base_offer_tier: 67_control or 99_treatment
  entry_platform: kajabi
  funnel_path: kajabi_klaviyo_67_v1 or kajabi_klaviyo_99_v1
  base_revenue_cents: 6700 or 9900
  upstream_ocus_status: pending
```

```text
Upstream Course OCU Accepted
  purchase_key: <Kajabi OCU transaction ID>
  upstream_ocus_offer_id: <exact ID after Kajabi creates it>
  upstream_ocus_price_cents: 9900
  entry_platform: kajabi
```

Neither event subscribes a person to email marketing or SMS. Existing consent stays exactly as it is. The transactional course-access message remains in Kajabi.

### Staged implementation state

The Content Hub now classifies the two base offers by their exact IDs and has a separate exact-ID-only classifier for the $99 Upstream OCU. It will not infer a buyer tier or an Upstream acceptance from a price, a title, or an incomplete generic Kajabi webhook payload.

| Configuration | Current state | Purpose |
|---|---|---|
| `KAJABI_KLAVIYO_BUYER_EVENT_ENABLED` | Disabled / absent | Must equal `true` before the receiver calls Klaviyo. |
| `KAJABI_UPSTREAM_COURSE_OCU_ID` | Blank | Must be the exact new Kajabi $99 Upstream OCU offer or upsell identifier. |
| Klaviyo private key | Existing server credential | Used only after the dispatch gate is enabled. |
| Klaviyo metric-triggered buyer flow | Not created or published | Must be draft-reviewed before the dispatch gate is enabled. |

The adapter creates a server-side Klaviyo event with a stable transaction-based `unique_id`. A Kajabi webhook retry for the same transaction therefore cannot create a second buyer-flow enrollment. It does not subscribe the person to email or SMS.

## Klaviyo flow configuration

The existing lead sequence remains the prospect flow. Add a **flow filter** so a person is not eligible to continue once they have performed `Interconnected Kajabi Buyer` after entering that flow.

Create one new draft flow:

> **`[DRAFT] Interconnected Kajabi Buyer Lifecycle — Event Trigger`**

| Trigger or exit | Action |
|---|---|
| Trigger: `Interconnected Kajabi Buyer` | Enroll the confirmed buyer only once. |
| Trigger filter | `base_offer_id` equals the $67 or $99 exact base-offer ID. |
| Flow filter | Email marketing eligibility is true before a marketing email is sent. |
| Immediate action | No marketing send. Kajabi owns the access email and immediate product delivery. |
| `Upstream Course OCU Accepted` | Exit the OCU-recovery branch and mark the profile as owning Upstream Course. |
| Future testing purchase | Exit any testing-promotion branch and hand off to testing fulfilment. |
| Unpurchased prospect | No event is created; they remain in the existing Klaviyo lead sequence. |

The first buyer email can go after the current expected delay, but it should be a paid-buyer orientation and course-use message—not a replacement for Kajabi’s access email. A short OCU recovery email is optional and should be sent only to buyers who **declined** the Upstream Course OCU, are marketing-eligible, and have not purchased that exact $99 Upstream offer. This recovery is a separate decision, not a prerequisite to the handoff.

## Measurement contract

| Metric | Authority | Definition |
|---|---|---|
| Base buyer and base revenue | Kajabi | Paid, non-refunded $67/$99 base offer purchase. |
| Upstream OCU attach rate | Kajabi | Accepted $99 Upstream OCU transactions ÷ eligible base buyers. |
| Buyer conversion | Content Hub | Distinct `Interconnected Kajabi Buyer` events ÷ qualified Klaviyo leads. |
| Course activation | Klaviyo | Paid-library / course click within the chosen early-use window. |
| Booked ROAS | First-party Kajabi revenue ÷ destination-tagged Meta spend | Meta purchase columns remain diagnostic only. |
| Later testing progression | First-party purchase ledger | Report separately; do not include it in immediate OCU economics. |

## Two viable ways to deploy the handoff

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---|
| **A. Event-based buyer handoff (recommended)** | The Content Hub sends one deduplicated Klaviyo purchase event when Kajabi confirms the base purchase. This gives clean enrollment, suppression, reporting, and a distinct OCU-accepted signal. | Existing platform capacity | Moderate |
| **B. Kajabi automation adds a tag/list membership** | Faster to configure but fragile: tags can be applied or removed manually, do not carry transaction-level deduplication, and are weaker for source/tier reporting. | Existing platform capacity | Low |

Approach A best matches the desired rule: **Klaviyo follows the lead until a confirmed Kajabi purchase changes the relationship to buyer.**

## What is required before activation

1. Finish the $199 standard Upstream Course offer and $99 restricted OCU offer in Kajabi.
2. Capture the exact $99 OCU offer ID or upsell ID from Kajabi. Do not classify it from price alone.
3. Confirm the $99 OCU is attached to both the $67 and $99 base offers and uses the intended video-led presentation.
4. Confirm the Kajabi `Purchase Created` webhook points to the existing Content Hub receiver.
5. Create the new draft Klaviyo event-triggered buyer flow using the two event names above; the server-side adapter is already staged.
6. Run one internal control-offer test and one treatment-offer test, with both OCU accept and OCU decline outcomes. Validate one transaction record, one Klaviyo buyer event, correct prospect exit, correct Kajabi access, correct OCU status, and no SMS enrollment.
7. Obtain explicit approval before publishing the new Klaviyo flow or moving a paid traffic destination.

## Explicitly not changed

This document does not change the current Shopify/Klaviyo challenger, the existing Kajabi control, any ads or budgets, customer-facing email content, phone/SMS consent, Kajabi offer settings, checkout paths, product access, or traffic allocation.

## References

[1]: https://help.kajabi.com/articles/sales/offers/how-to-send-customers-to-a-landing-page-after-checkout "Send customers to a landing page after checkout"

[2]: https://help.kajabi.com/articles/api-integrations/webhooks/what-information-is-sent-with-outbound-webhooks "Outbound webhook data reference"

[3]: https://developers.klaviyo.com/en/reference/create_event "Create Event"
