# Interconnected $67 Buyer Lifecycle Audit and Proposed Nurture Sequence

**Prepared by:** Manus AI  
**Date:** September 20, 2026  
**Status:** Audit complete; proposed sequence only. No live flow, email, SMS, order, product, checkout, webinar, or advertising setting was changed.

## Conclusion

**The gap is real and material.** The current system recognizes an exact $67 Interconnected purchase, but it does not give that buyer a complete post-purchase journey. The only live Klaviyo flow built specifically for the product has one immediate marketing email. That email offers the $199 test-and-coach package. It does not orient the buyer to the series, help them use the protocol, invite them into the relevant live education, or create a considered progression into testing and the broader Urban Monk ecosystem.

There are substantial live sequences for people who have already purchased testing products. Those flows do not enroll a buyer of **Interconnected: The Complete Healing Protocol**. The active lead-nurture flow does continue to send a nine-plus-bonus episode screening series, but it is still written and labeled as a **free** screening experience. It has no visible purchase exit or buyer-specific branch. A paid buyer therefore receives a $199 offer and may continue to receive free-series messages, instead of entering an owned, paid-client experience.

The product page promises permanent access to the complete series, a 30-day protocol, a companion guide, a masterclass, and optional community access. It also says that access details will be sent after purchase. The exact-$67 buyer flow does not contain an access-delivery email, so the delivery mechanism behind that promise is **not verified by this audit** and must be checked before adding any marketing sequence.[1]

## What is live today

| Journey component | Current behavior | Assessment |
|---|---|---|
| $67 purchase recognition | The Content Hub records the paid Shopify order, updates the Klaviyo profile, and emits a Klaviyo `Placed Order` event containing the purchased item. | **Working technical trigger.** |
| Exact $67 buyer flow | The live flow named **[READY] Interconnected $67 → $199 Member Offer — Klaviyo Treatment V2** triggers when `Placed Order` includes **Interconnected: The Complete Healing Protocol**. It contains one live email: “Your next Interconnected step is ready.” | **Insufficient lifecycle.** It is a one-message $199 offer, not onboarding or engagement. |
| $199 test fulfillment | The live **IC Supported Fulfillment** flow has a multi-message gut-test education sequence. Its trigger is the testing-kit / supported-package purchase, not the $67 protocol. | **Appropriate for test buyers, not $67 buyers.** |
| Free-series sequence | The live KO screening flow sends the free-series episodes. Its visible action path contains no buyer branch or purchase exit. | **Helpful content, but not a paid-buyer experience.** |
| $199 one-click offer | Zipify is the primary immediate post-purchase route. Klaviyo also has an immediate one-email $199 offer fallback. | **Potential overlap.** The email should become a delayed fallback after Zipify has had time to resolve the accepted or declined order state. |
| Access delivery | The public product promises that access details are sent after purchase. The buyer-specific Klaviyo flow is not that delivery mechanism. | **Unverified. Treat as a priority QA item.** |

## What this means commercially

A $67 buyer has demonstrated intent, trust, and willingness to pay. The immediate job is not to push a second transaction before they understand what they bought. The immediate job is to help them activate the asset: watch the series, use one practical tool, feel the brand’s point of view, and recognize when testing or guided support would make their next step more specific.

The current one-message $199 offer can still have a role. Its proper role is as a **recovery path** for a buyer who did not see or did not accept the native Zipify offer. It should not be the entire relationship.

## Selected implementation architecture: Approach A

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **A. Dedicated paid-buyer lifecycle** | Creates a distinct paid-client experience; preserves the free sequence for nonbuyers; supports clean measurement and proper exits into testing, fulfillment, webinars, and core offers. Requires a new controlled flow and one-time access-delivery verification. | Existing platform capacity | Moderate |
| **B. Add buyer branches inside the current free-screening flow** | Fewer flows to manage, but buyer logic becomes embedded in a 21-action acquisition flow and is harder to audit, improve, and measure. It also makes future offer and webinar work more fragile. | Existing platform capacity | Lower initially; higher ongoing risk |

The owner selected **Approach A** on September 20, 2026. The sequence below is therefore the approved architecture for a future draft-only build: a dedicated, purchase-triggered buyer lifecycle that is separate from the free-screening sequence. This selection does not activate a flow, alter a message, or replace the remaining access-delivery, destination, copy, timing, and proofing gates.

## Required control rules before activation

### 1. Separate access delivery from marketing

The first buyer communication must deliver what was sold. It should be a transactional Shopify or approved digital-fulfillment message, sent to every buyer regardless of marketing consent. It must contain the verified access instructions or library link, the 30-day protocol, companion guide, masterclass, and community instructions exactly as they exist.

Do **not** use a marketing flow as a substitute for access delivery. The current public promise, “Access details will be sent after purchase,” should be proven with a controlled test or a direct fulfillment-app audit before this sequence is activated.[1]

### 2. Give Zipify the first $199 opportunity

The native post-purchase offer is the primary $199 path for eligible card checkouts. The current $67 buyer email offer should be converted to a fallback: wait at least 20 minutes after the confirmed $67 payment, then send only if the buyer does not have the $199 product on the amended order. This protects the buyer from receiving an unnecessary email while they are still on the one-click post-purchase screen.

### 3. Remove buyers from the free-screening experience

A buyer should not keep receiving “free access” positioning after purchasing permanent access. Before the dedicated paid-buyer flow begins, add a purchase-based exit or per-message flow filter to the free screening path. The buyer may still receive episode content, but the framing must shift from *try the free series* to *use the protocol you own*.

### 4. Keep communications consent-safe

No SMS should be added unless the profile has explicit SMS marketing consent. Buyer onboarding and offer messages should use email only for now. Buyers without email marketing consent should receive only the verified transaction/access communication and product-required support.

### 5. Use current, approved destinations only

The series-library destination and the current webinar registration or replay URL must be verified at implementation. Do not invent a webinar date, countdown, scarcity window, medical claim, or Academy offer detail in this sequence. When there is no live webinar scheduled, replace the webinar invitation with an approved evergreen teaching/replay page.

## Proposed paid-buyer sequence

**Enrollment:** Confirmed Shopify `Placed Order` containing **Interconnected: The Complete Healing Protocol**.  
**Marketing eligibility:** Email marketing consent only.  
**Immediate exits:** Existing $199 test-and-coach purchase; refund or cancellation; suppression/unsubscribe.  
**Handoffs:** $199 test buyer → current test fulfillment flow. Webinar registrant → webinar attendance and follow-up path.  
**No SMS:** Unless separately authorized and consented.

| Timing | Message role | Subject line | Primary CTA | Exit / branch rule |
|---|---|---|---|---|
| Immediately | Transactional access delivery | **Your Interconnected access is ready** | **Open your complete protocol** | Separate fulfillment message; not marketing-gated. |
| 20 minutes | $199 recovery only | **If you want to make your next step more specific** | **See the member test + coach option** | Send only if the $199 product is not on the updated order. |
| Day 1 | Paid orientation | **You own the complete protocol. Start here.** | **Watch Episode 1 and open your guide** | Stop promotional test messages if $199 is purchased. |
| Day 3 | Series activation | **Don’t binge the series—use it this way** | **Continue with the next episode** | Keep paid-buyer framing. |
| Day 6 | Protocol engagement | **A simple 30-day way to turn insight into action** | **Start the Gut Restoration protocol** | Record a guide/protocol click where possible. |
| Day 9 | Testing education | **When more information can make the next step clearer** | **Explore the member testing option** | Soft educational invitation; no diagnosis or urgency claim. |
| Day 13 | Live education | **The next Interconnected conversation is live** | **Reserve your place** | Use only a verified webinar/replay destination. |
| Day 17 | Decision support | **You have context now. Choose your next right step.** | **Choose self-guided, testing, or live learning** | Test buyer exits to fulfillment; webinar registrant exits to webinar path. |
| Day 24 | Re-engagement | **Before you move on, return to this one piece** | **Reopen your protocol** | Use a single reflection prompt, not a new offer. |
| Day 30 | Progress review / core-funnel handoff | **What do you want your next 30 days to look like?** | **Join the next live session** | Route high-intent buyers into the approved webinar/core-offer path. |

## Draft email copy

The text below is ready for a copy review. Bracketed destinations are implementation placeholders, not instructions to send to customers before they are verified.

### Transactional access delivery — immediately after payment

**Subject:** Your Interconnected access is ready  
**Preview:** Your complete series, companion tools, and next steps are here.

Welcome to **Interconnected: The Complete Healing Protocol**.

You now have permanent access to the complete series and the practical tools that help you use what you learn at your own pace.

Start with one simple step: open the protocol, watch the first episode, and choose one idea you want to carry into the week. You do not need to overhaul your life tonight. You only need a clear next action.

Inside your access area, you will find the complete series, the Gut Restoration Starter Protocol, the Interconnected Companion Guide, the 5 Root Causes Masterclass, and the private community details.

**Button:** Open your complete protocol  
**Destination:** `[verified paid-access/library URL]`

> This message must be delivered through the verified transaction or digital-fulfillment mechanism. It should not depend on marketing consent.

### Email 1 — Day 1: paid orientation

**Subject:** You own the complete protocol. Start here.  
**Preview:** A simple way to make the series useful without turning it into homework.

You did not buy a pile of videos. You bought a place to slow down, see the larger picture, and make better next-step decisions.

Here is the best way to begin:

1. Watch Episode 1 without trying to solve everything at once.
2. Open the Companion Guide afterward.
3. Write down the one pattern, question, or habit that feels most relevant to your life right now.

That is enough for today. The goal is not perfect compliance. It is a more honest starting point.

**Button:** Watch Episode 1 and open your guide  
**Destination:** `[verified paid Episode 1 / library destination]`

### Email 2 — Day 3: series activation

**Subject:** Don’t binge the series—use it this way  
**Preview:** A better way to turn what you watch into something that changes how you live.

The most useful question after each episode is not, “Did I learn something interesting?”

It is: **“What does this change about the way I see my own health?”**

As you continue, give yourself permission to pause. Take one note. Talk about it with someone you trust. Return to the sections that create a real reaction.

The protocol is designed to meet you over time. You do not have to finish it in a weekend to get value from it.

**Button:** Continue with the next episode  
**Destination:** `[verified paid series/library destination]`

### Email 3 — Day 6: protocol engagement

**Subject:** A simple 30-day way to turn insight into action  
**Preview:** Use the starter protocol as a guide, not a rulebook.

Learning creates context. A practical routine creates momentum.

Your Gut Restoration Starter Protocol is meant to help you choose a few steady actions that support the foundations: food, rhythm, recovery, movement, and awareness. It is not a diagnosis and it is not a rigid plan. It is a way to notice what changes when you practice the basics with more intention.

Choose one action you can sustain this week. Put it on your calendar. Then let the next episode deepen the conversation.

**Button:** Start the 30-day protocol  
**Destination:** `[verified starter-protocol destination]`

### Email 4 — Day 9: testing education

**Subject:** When more information can make the next step clearer  
**Preview:** Education gives you context. Better data can help you ask a more specific question.

For some people, the series and protocol are the right next step. For others, persistent questions make it useful to gather more information and discuss it with a qualified professional.

That is why we make the member testing option available. It includes the stated food-sensitivity and gut-permeability testing package, along with a private one-hour health-coach conversation to help you organize what comes next.

It is not a promise to diagnose or treat a condition. It is an option for people who want a more individualized conversation after building the right foundation.

**Button:** Explore the member testing option  
**Destination:** `[approved $199 Shopify product / tracked email route]`

### Email 5 — Day 13: live education

**Subject:** The next Interconnected conversation is live  
**Preview:** Bring the questions the series has opened up for you.

The series gives you a framework. A live conversation gives you a place to connect the dots, hear the deeper context, and decide what is worth exploring next.

If you have been watching and thinking, “How does this apply to me?” this is the room to bring that question.

You do not need to have completed every episode. Come with the question that is most alive for you right now.

**Button:** Reserve your place  
**Destination:** `[verified next Interconnected webinar registration URL]`

> If no live event is scheduled, use an approved evergreen workshop or replay and change the subject line to “A deeper Interconnected conversation.”

### Email 6 — Day 17: decision support

**Subject:** You have context now. Choose your next right step.  
**Preview:** There is no universal next step—only the one that fits where you are.

There are three good ways to continue from here:

- **Stay self-guided:** keep working through the series, guide, and 30-day protocol.
- **Make the picture more specific:** explore the member testing and health-coach option.
- **Go deeper in community:** join the next live Interconnected teaching session and hear how the larger framework comes together.

There is no pressure to choose all three. The point is to choose the next step that helps you stay engaged with the work you have already begun.

**Button:** Choose your next step  
**Destination:** `[approved buyer-next-step hub or current webinar page]`

### Email 7 — Day 24: re-engagement

**Subject:** Before you move on, return to this one piece  
**Preview:** The work is not in finishing everything. It is in returning to what matters.

Most people do not need another flood of information. They need a chance to revisit the one insight that actually landed.

Open the Companion Guide again. Find the note you made after an episode. Ask yourself one simple question:

> What is one small change I am willing to protect for the next seven days?

That answer is a better starting point than a dramatic reset.

**Button:** Reopen your protocol  
**Destination:** `[verified paid-access/library URL]`

### Email 8 — Day 30: progress review and core-funnel handoff

**Subject:** What do you want your next 30 days to look like?  
**Preview:** Use what you have learned to decide what deserves more attention.

You now have more than content. You have a clearer map of the connections among daily habits, gut health, recovery, and the patterns that shape how you feel.

The question is no longer whether you need to do everything. It is whether you are ready to choose the next layer of support that fits your situation.

If you want a live place to continue the conversation, the next Interconnected session is where we unpack the bigger framework and show the available paths forward.

**Button:** Join the next live session  
**Destination:** `[verified webinar or core-funnel registration URL]`

## Measurement plan

Do not judge the sequence by opens alone. The purpose is buyer activation and qualified progression.

| Metric | Definition | Why it matters |
|---|---|---|
| Access-delivery rate | Paid $67 buyers receiving the verified transactional access communication | Confirms the promise made on the product page is fulfilled. |
| Paid-series activation | Buyers clicking a paid-library or episode CTA within 72 hours | Measures whether people actually start what they bought. |
| Protocol engagement | Buyers clicking the 30-day protocol or companion-guide CTA | Measures movement from passive viewing into use. |
| Testing interest | Unique $67 buyers clicking the approved $199 testing route | Measures qualified education-driven demand. |
| Native $199 attach | $199 accepted inside the amended original Zipify order | Measures the primary one-click path. |
| Email-fallback $199 attach | $199 paid separately after the delayed recovery email | Keeps non-native buyers visible rather than blending outcomes. |
| Webinar registration and attendance | Buyers registering for and attending the current approved session | Measures progress into deeper education and the core funnel. |
| Core-offer conversion | Cleared, paid, non-refunded downstream conversion after the declared attribution window | Measures commercial value without mistaking click activity for revenue. |

Use first-party Shopify paid orders for the $67 and $199 revenue truth. Keep native $199 attach, email-fallback attach, and webinar-derived downstream conversion separate.

## Approval gates before a live build

1. Verify the actual digital-access delivery mechanism for the $67 product. The product page promise must be fulfilled before nurture begins.
2. Choose **Approach A** or **Approach B** from the implementation table.
3. Approve the sender, message cadence, and final destinations for the eight marketing messages.
4. Provide or select the current paid-series library URL, protocol/guide URLs, and next webinar registration or evergreen replay URL.
5. Approve conversion of the current immediate $199 email to a delayed, purchase-suppressed fallback that follows the native Zipify offer.
6. Confirm the desired downstream webinar/core-offer handoff after the Day-30 check-in. No Academy or other high-ticket offer should be inserted until its exact route and offer terms are verified.
7. Create and proof the new flow in draft mode, then send an owner-approved test only before the flow is made live.

## References

[1]: https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol "Interconnected: The Complete Healing Protocol"
[2]: https://www.klaviyo.com/flow/ThkCXz/edit "Klaviyo: Exact $67 buyer $199 member-offer flow"
[3]: https://www.klaviyo.com/flow/TZ8wNL/edit "Klaviyo: IC Supported Fulfillment flow"
[4]: https://www.klaviyo.com/flow/YyFZPu/edit "Klaviyo: Live Interconnected KO screening flow"
[5]: https://content.theurbanmonk.com/interconnected/thank-you-klaviyo "Interconnected Klaviyo thank-you page"
