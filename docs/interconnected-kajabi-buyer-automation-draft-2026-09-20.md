# Interconnected Buyer Automation Draft — Kajabi $67 and $99

**Status:** **Draft only.** The buyer email sequence exists in Kajabi, but it has **zero subscribers** and **zero subscribe triggers**. No buyer can receive this sequence from the current configuration.

## What is now present in Kajabi

A new buyer-only Email Sequence named **`[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99`** has been created in the Urban Monk Academy Kajabi account. Its first message, **“01 - Access Delivery (transactional review),”** is set to Day 0 and uses the existing **Urban Monk “Gut Test Promo Weekly”** template. Its internal subject and preview text are populated from the approved sequence:

> **Subject:** Your Interconnected protocol is ready  
> **Preview:** Everything you just unlocked, in one place. Start with one small step.

The body uses the approved Claude copy and intentionally retains all unresolved `{{TOKEN}}` placeholders. This preserves a reviewable version without inventing access, guide, community, webinar, testing, or support links. No test email was sent.

The sequence is available in Kajabi at:

<https://app.kajabi.com/admin/email_sequences/2148891667>

## The important constraint

A **Kajabi “Offer is purchased”** automation can correctly identify a purchase of either Kajabi front-end offer:

| Offer | Kajabi offer ID | Correct Kajabi trigger |
|---|---:|---|
| Interconnected $67 control | 2151314475 | Offer is purchased → Interconnected $67 control |
| Interconnected $99 treatment | 2151402817 | Offer is purchased → Interconnected $99 treatment |

That automation would **not** identify a purchase from the live **Shopify/Klaviyo LP-3 route**. That buyer pays Shopify, not a Kajabi offer. A Kajabi-only launch would therefore leave the paid Shopify cohort outside the buyer journey—the exact gap this work is meant to close.

The correct architecture uses the same buyer lifecycle but has two entry paths:

1. **Kajabi buyer path.** A Kajabi Offer-purchased automation enters a buyer only when either the $67 control or the $99 treatment is purchased in Kajabi.
2. **Shopify buyer path.** The paid Shopify order receiver enters a buyer only after a paid, non-cancelled Shopify order for the Interconnected product. It must use the order record, not browser checkout traffic.

Both paths should add the same dedicated buyer identity and enroll the buyer only once in the same marketing sequence. They should remain separate at the purchase layer so the destination split test stays measurable.

## Why the current sequence cannot be made live as written

Email 1 is specified as **transactional** and must send regardless of marketing consent. Kajabi Email Sequences are marketing messages and do not deliver to contacts who are not subscribed to marketing email. Therefore the Day-0 sequence message is a **review artifact**, not the final fulfillment mechanism. Access delivery must remain in a transactional product-fulfillment path, or be sent from a consent-safe transactional service.

Email 2 is specified for **20 minutes after purchase**, only when the $199 product is absent from the original or amended order. Kajabi’s current Wait Node supports a set delay starting at **30 minutes**. Its Email Sequence schedule uses Day 0, Day 1, and later calendar-day intervals, rather than a 20-minute sequence interval. More importantly, Kajabi cannot reliably evaluate a Shopify Zipify post-purchase amendment in the same buyer record. This gate belongs in the Shopify/Content Hub purchase ledger.

> The safe implementation is therefore **two coordinated layers**: transactional access and Shopify-native $199 suppression outside Kajabi; consent-based nurture in Kajabi only after the buyer is eligible.

## Review-ready automation map

### A. Transactional access delivery — not a Kajabi Email Sequence

**Entry:** A paid, non-cancelled Interconnected $67 or $99 order in the authoritative purchase system.

**Action:** Send Email 1 once, using the approved fulfillment copy after all access URLs and support email are verified. This must not depend on marketing consent.

**Guardrails:** Do not send after a cancelled/refunded order. Do not send a second copy after a Shopify `orders/updated` event. Do not substitute a Kajabi marketing email for product access.

### B. $199 member-offer recovery — Shopify/Content Hub only

**Entry:** A paid $67 Interconnected order with no $199 member offer in the original order.

**Delay:** **30 minutes**, the closest Kajabi-supported delay only if Kajabi is used as a presentation layer. The source of truth must still be the Shopify order ledger.

**Condition before send:** Re-read the Shopify order after the Zipify window. Suppress the message if the $199 line item is present on the final/amended order. This prevents a buyer who accepted the one-click offer from receiving a redundant recovery offer.

**Action:** Send Email 2 only to marketing-consented buyers. The message must link to the standard $199 checkout and must not call the later purchase “one click.”

### C. Buyer nurture sequence — Kajabi Email Sequence

**Entry identity:** `Interconnected Paid Buyer` (or an equivalent dedicated tag/profile attribute). Do not reuse generic free-screening tags.

**Source events:**

- Kajabi $67 control purchased → apply buyer identity.
- Kajabi $99 treatment purchased → apply buyer identity.
- Shopify $67 paid order → apply the same buyer identity through the existing Shopify/Content Hub bridge, after the paid-order check.

**Sequence timing:** Email 3 on Day 1; Email 4 on Day 3; Email 5 on Day 6; Email 6 on Day 9; Email 7 on Day 13; Email 8 on Day 17; Email 9 on Day 24; and Email 10 on Day 30.

**Exit and exclusion rules:**

- Remove/stop the buyer from the free-screening nurture once a qualifying paid purchase occurs.
- Do not re-enroll a repeat purchaser.
- Do not send Email 2 to an order containing the $199 product.
- Keep Kajabi $67/$99 revenue and Shopify LP-3 revenue in distinct measurement ledgers.

## Exact next build order

1. Verify every `{{TOKEN}}` destination and the access-delivery owner. The current draft intentionally has no invented links.
2. Complete Emails 3–10 in the existing Kajabi draft using the same Urban Monk template. These are marketing-consent messages.
3. Configure the two **Kajabi offer-purchased** draft branches for the $67 control and $99 treatment, each adding the same buyer identity and subscribing that buyer to the completed nurture sequence.
4. Add the Shopify paid-order branch in the Content Hub so a Shopify buyer receives the same buyer identity without creating a duplicate Kajabi purchase record.
5. Implement the $199 recovery against the Shopify order ledger with a 30-minute wait and a final-order suppression check.
6. Test only with approved test records, confirm buyer exclusion from the free-screening flow, and inspect email rendering before activation.
7. Activate only after the URLs, access delivery, consent rule, $199 suppression, and attribution checks are signed off.

## What has not changed

No automation trigger has been attached. No buyer has been subscribed. No email has been sent or scheduled. No offer, price, product access, checkout, Shopify setting, Klaviyo setting, payment, advertising setting, or live journey has changed.

## References

[1]: https://help.kajabi.com/articles/marketing/email-campaigns/create-an-email-sequence "Create an Email Sequence"
[2]: https://help.kajabi.com/articles/marketing/email-campaigns/how-to-subscribe-contacts-to-an-email-sequence "Subscribe contacts to an Email Sequence"
[3]: https://help.kajabi.com/articles/marketing/automations/how-to-use-a-wait-node-with-automations "Use a Wait Node with Automations"
[4]: https://help.kajabi.com/articles/marketing/email-campaigns/how-to-customize-when-email-campaigns-are-sent "Customize when Email Campaigns are sent"
