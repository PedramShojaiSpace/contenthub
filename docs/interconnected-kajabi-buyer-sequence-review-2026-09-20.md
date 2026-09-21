# Interconnected Paid Buyer Lifecycle — Kajabi Draft Review

**Author:** Manus AI  
**Date:** 20 September 2026  
**Status:** **Review-only draft.** The sequence has **zero subscribers**, **zero subscribe triggers**, and **zero sent emails**. It cannot send to anyone in its present state.

## What is ready for review

The dedicated buyer sequence is now present in Kajabi as **`[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99`**. It contains all ten intended lifecycle positions and uses the existing Urban Monk email-template family. The live review page is:

<https://app.kajabi.com/admin/email_sequences/2148891667>

The schedule below is the actual Kajabi configuration. All dates are measured from the time a buyer would be subscribed to the sequence; no one is currently subscribed.

| Position | Schedule | Internal title | Subject line | Preview text | Body-review status |
|---|---:|---|---|---|---|
| 1 | Immediately | Access Delivery (transactional review) | Your Interconnected protocol is ready | Everything you just unlocked, in one place. Start with one small step. | Claude copy is installed with unresolved destination tokens retained for review. |
| 2 | Day 1, 8:00 AM PDT | $199 Recovery | One optional next step, if you want to go deeper | Optional — the fastest way to stop guessing about your food. | Structural draft only; this message belongs in a Shopify-led 30-minute post-purchase check, not this final Kajabi sequence. |
| 3 | Day 1, 9:00 AM PDT | Day 1 Orientation | Start here (not everywhere) | You own all of it. You do not have to do all of it at once. | Structural draft; Claude body still needs to be placed into the template. |
| 4 | Day 3, 8:00 AM PDT | Day 3 Series Activation | Watch less, notice more | One note per episode beats ten hours of passive watching. | Structural draft; Claude body still needs to be placed into the template. |
| 5 | Day 6, 8:00 AM PDT | Day 6 Testing Education | When healthy habits still do not work | Good decisions get easier when you stop guessing. | Structural draft; Claude body still needs to be placed into the template. |
| 6 | Day 9, 8:00 AM PDT | Day 9 Decision Support | The next step is not a life sentence | A clear next step is enough for today. | Structural draft; Claude body still needs to be placed into the template. |
| 7 | Day 13, 8:00 AM PDT | Day 13 Webinar Invitation | Bring your questions. This one is for you. | A live conversation to connect the dots. | Structural draft; Claude body and final webinar link still need to be placed into the template. |
| 8 | Day 17, 8:00 AM PDT | Day 17 Re-engagement | You did not fail the protocol | Restarting is part of the work. | Structural draft; Claude body still needs to be placed into the template. |
| 9 | Day 24, 8:00 AM PDT | Day 24 Decision Handoff | If you want more clarity, here is the path | A deeper roadmap is available when you are ready. | Structural draft; Claude body and approved decision destination still need to be placed into the template. |
| 10 | Day 30, 8:00 AM PDT | Day 30 Lifecycle Handoff | The work continues. You are not doing it alone. | Keep the next step small, honest, and connected. | Structural draft; Claude body and approved ongoing-path destination still need to be placed into the template. |

## Important review distinction

The ten-message **schedule and subject-line architecture are complete**. Only Email 1 currently contains the approved Claude body copy. Emails 2–10 use the selected Urban Monk visual template, but their full Claude body copy has **not** been transferred into Kajabi yet. This is intentional disclosure: the sequence is ready to review as a lifecycle map, but it is not ready to activate.

Email 2 is shown inside the draft solely so the lifecycle can be reviewed in one place. It must be removed from the final Kajabi nurture sequence and implemented separately. The correct production rule is: wait at least 30 minutes after a paid Shopify $67 purchase, read the final amended Shopify order, and send the $199 recovery only if the $199 line item is absent and the buyer has marketing-email consent. This avoids sending an upsell recovery email to a buyer who accepted the Zipify one-click offer.

Email 1 is also not a final Kajabi marketing-sequence delivery mechanism. It is a review copy for transactional access delivery. Product access must be sent from a transactional fulfillment path because Kajabi marketing sequences do not reach buyers who lack marketing-email consent.

## Before any activation

The next build phase should transfer the approved Claude bodies into Emails 3–10, verify every access, episode, webinar, testing, support, and decision-link destination, and render-test each email. After that, two draft entry paths can be added for the Kajabi $67 and $99 offers. A separate Shopify paid-order pathway must enroll Shopify/Klaviyo LP-3 buyers once and must stop the free-screening sequence after the purchase. No automation, buyer enrollment, email send, offer, checkout, or advertising setting was enabled in this review stage.

## References

[1]: https://help.kajabi.com/articles/marketing/email-campaigns/create-an-email-sequence "Create an Email Sequence"
[2]: https://help.kajabi.com/articles/marketing/email-campaigns/how-to-subscribe-contacts-to-an-email-sequence "Subscribe contacts to an Email Sequence"
[3]: https://help.kajabi.com/articles/marketing/automations/how-to-use-a-wait-node-with-automations "Use a Wait Node with Automations"
