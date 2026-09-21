# Interconnected Paid Buyer Lifecycle — Kajabi Draft Review

**Author:** Manus AI  
**Date:** 20 September 2026  
**Status:** **Draft-only; no sending has been enabled.** The sequence has **zero subscribers**, **zero subscribe triggers**, and **zero sent emails**. It cannot send to anyone in its current state.

## Current Kajabi draft

The dedicated buyer lifecycle remains in Kajabi as **`[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99`**:

<https://app.kajabi.com/admin/email_sequences/2148891667>

It contains ten intended lifecycle positions on the following schedule: immediate access-delivery review; Day 1 $199 recovery review; Day 1 orientation; Day 3 series activation; Day 6 protocol activation; Day 9 testing education; Day 13 live education; Day 17 decision support; Day 24 re-engagement; and Day 30 progress review and handoff. The Kajabi draft remains **review-only**. It is not connected to either offer, Shopify, a tag, or any automation.

## Change of implementation path — use the Content Hub Email Optimizer

The Kajabi visual-template editor is not an acceptable production workflow for transferring long-form sequence copy. It contains multiple unrelated text and image blocks, which makes manual block selection slow, error-prone, and difficult to validate. The owner correctly directed a switch to the established **Content Hub Email Optimizer**.

A live read of the Email Optimizer at <https://content.theurbanmonk.com/hub/content/email-optimizer> confirms the intended workflow:

| Email Optimizer mode | Intended use | Relevance to this sequence |
|---|---|---|
| One-Click Bookmarklet | Manual Kajabi broadcasts | Not appropriate for this automated buyer journey. |
| **Bulk Sequence Optimizer** | Kajabi automations and sequences | **Selected implementation path.** It is designed for recurring/automated emails. |
| Single Email | One-off content review | Optional copy/HTML QA only. |
| Sendy Handoff | Manual Sendy handoff | Out of scope. |

The sequence copy will be processed as full HTML in the **Bulk Sequence Optimizer**, then the resulting HTML will be used as the canonical source for the buyer sequence. This replaces repeated visual-editor manipulation. The existing Kajabi sequence remains a non-live review scaffold until the optimized HTML is available and the unresolved destination placeholders are supplied.

## Non-negotiable production constraints

1. **Email 1 is transactional access delivery**, not a Kajabi marketing-sequence message. It must not depend on marketing consent.
2. **Email 2 is a Shopify-led $199 recovery rule**, not a standard calendar-day Kajabi touch. It must wait at least 30 minutes, re-read the final/amended order, and suppress when the $199 line item is present.
3. **Emails 3–10 require marketing consent.** They must not be activated until all `{{TOKEN}}` values resolve to approved URLs.
4. **Kajabi $67 and $99 buyer entry paths and Shopify buyer entry paths remain distinct.** They may share a downstream nurture identity, but must remain separate in revenue attribution.
5. **No automation, enrollment, email send, offer, checkout, payment, pixel, traffic, or budget setting has been activated or changed by this handoff.**

## Next implementation sequence

1. Open **Bulk Sequence Optimizer** and import the Claude-approved sequence as separate HTML entries.
2. Use the optimizer-generated HTML as the canonical copy artifact, preserving every unresolved `{{TOKEN}}` exactly.
3. QA subject, preview, CTA count, placeholder retention, and visible rendering for each message.
4. Replace or recreate the Kajabi sequence bodies from that canonical HTML only after review, without enabling the sequence or an entry trigger.
5. Build the consent-safe Kajabi and Shopify entry architecture separately, test with approved records, and request explicit activation approval only after the unresolved URLs and suppression logic are complete.

## References

[1]: https://content.theurbanmonk.com/hub/content/email-optimizer "Urban Monk Content Hub — Email Optimizer"
[2]: https://help.kajabi.com/articles/marketing/email-campaigns/create-an-email-sequence "Create an Email Sequence"
[3]: https://help.kajabi.com/articles/marketing/email-campaigns/how-to-subscribe-contacts-to-an-email-sequence "Subscribe contacts to an Email Sequence"
[4]: https://help.kajabi.com/articles/marketing/automations/how-to-use-a-wait-node-with-automations "Use a Wait Node with Automations"
