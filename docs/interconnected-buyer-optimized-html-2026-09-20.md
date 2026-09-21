# Interconnected Buyer Sequence — Canonical Optimized HTML

**Author:** Manus AI  
**Date:** 20 September 2026  
**Status:** Draft assets only. No sequence enrollment, email send, offer, payment, checkout, tracking, or traffic setting was changed.

This folder contains the Claude-approved Interconnected buyer sequence rendered as simple, consistent HTML body fragments and processed through the existing Content Hub Email Optimizer. These are the canonical source blocks for review; they are not live emails. Each document is intentionally a single HTML payload, ready to paste into the source-code view of the correct Kajabi message after the final destination placeholders have been replaced.

| # | Lifecycle email | Subject selected | Preview text | Optimized HTML file | Size |
|---|---|---|---|---|---|
| 1 | Access Delivery (Transactional) | Your Interconnected protocol is ready | Everything you just unlocked, in one place. Start with one small step. | `01-access-delivery-transactional.html` | 2860 → 2843 bytes |
| 2 | $199 Member Offer Recovery (Delayed) | One optional next step, if you want to go deeper | Optional — the fastest way to stop guessing about your food. | `02-199-member-offer-recovery-delayed.html` | 2367 → 2353 bytes |
| 3 | Day 1: Paid Orientation | Start here (not everywhere) | You own all of it. You don't have to do all of it at once. | `03-day-1-paid-orientation.html` | 2011 → 2014 bytes |
| 4 | Day 3: Series Activation | Watch less, notice more | One note per episode beats ten hours of passive watching. | `04-day-3-series-activation.html` | 2068 → 2047 bytes |
| 5 | Day 6: Protocol Activation | Your 30-day reset — one step, not fifty | The 30-day protocol is a guide, not a rulebook. Start with one change. | `05-day-6-protocol-activation.html` | 2035 → 2018 bytes |
| 6 | Day 9: Testing Education | The foods working against you (you can't see them) | The protocol gives you principles. A test gives you your specifics. | `06-day-9-testing-education.html` | 2459 → 2436 bytes |
| 7 | Day 13: Live Education | Bring your questions to a live session | A place to bring your questions and connect what you've learned. | `07-day-13-live-education.html` | 1944 → 1932 bytes |
| 8 | Day 17: Decision Support | Three honest paths from here | Self-guided, testing plus a coach, or live learning. Pick your fit. | `08-day-17-decision-support.html` | 2173 → 2173 bytes |
| 9 | Day 24: Re-engagement | One small change, protected | Not more information. One change worth protecting. | `09-day-24-re-engagement.html` | 1981 → 1966 bytes |
| 10 | Day 30: Progress Review & Handoff | A month in — look back before you look forward | Reflect on the month, then take the next step with us. | `10-day-30-progress-review-handoff.html` | 2244 → 2204 bytes |

## Required review before any activation

The unresolved `{{TOKEN}}` placeholders have been deliberately preserved. They must resolve to approved destinations before a message can become live. Email 1 is transactional access delivery; Email 2 must be run by Shopify-side post-purchase logic only after the final/amended order is checked for the $199 product; Emails 3 through 10 require marketing consent. The current Kajabi sequence remains draft-only and has no entry trigger.

The Email Optimizer reduces avoidable markup and template signals; it cannot guarantee inbox-tab placement because Gmail decides placement per recipient. Existing Kajabi compliance footer and unsubscribe controls must remain in the final marketing emails. [1]

## References

[1]: https://content.theurbanmonk.com/hub/content/email-optimizer "Urban Monk Content Hub — Email Optimizer"
