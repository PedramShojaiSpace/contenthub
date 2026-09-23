# Unbounce LP-3 → Klaviyo Flow and SMS Audit

**Author:** Manus AI  
**Audit timestamp:** 23 September 2026, 15:15 Central  
**Scope:** Read-only review of the live Unbounce LP-3 cohort from 20 September 2026, 11:07 Central onward. All results are aggregate only.

## Conclusion

The Unbounce LP-3 form sends contacts into **two parallel live Klaviyo flows**, both triggered by membership in the same list, **Interconnected Free Screening Opt-Ins**. The email flow is functioning. The SMS flow exists and is live, but its actual send coverage is materially incomplete: only **6 of 73** people who explicitly consented to SMS have a post-opt-in outbound SMS event. Three outbound SMS attempts also have a later delivery-failure event.

The evidence indicates a sequencing defect in the lead bridge. The application currently adds a consented lead to the email-list trigger before it submits the SMS subscription job. Because the SMS Day 0 action is immediate, Klaviyo can evaluate the contact before its SMS marketing consent is present. This explains why the SMS flow is live yet most consented LP-3 contacts have not received a recorded outbound text. This is an evidence-based diagnosis from the live flow configuration, the first-party write order, and the delivery audit; no live flow or messaging setting was changed during this review.

## Exact live flows to label in Klaviyo

| Channel | Current live flow name | Flow ID | What starts it | Current status |
|---|---|---|---|---|
| Email | **[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN** | `YyFZPu` | Added to **Interconnected Free Screening Opt-Ins** | Live; 11 email actions; no SMS actions |
| SMS | **[LIVE — COMPLIANT SMS] Interconnected Free Screening - KO** | `TvXwNj` | Added to **Interconnected Free Screening Opt-Ins** | Live; 11 SMS actions; no email actions |

The current names already distinguish email and SMS, but the proposed labels below are clearer in a crowded Klaviyo account:

| Current flow | Recommended display name |
|---|---|
| `YyFZPu` | **[LIVE — UNBOUNCE LP-3] KO Email: Free Screening → Kajabi Checkout** |
| `TvXwNj` | **[LIVE — UNBOUNCE LP-3] KO SMS: Consent-Only Free Screening** |

Renaming is presentation-only and would not change enrollment, timing, copy, consent, checkout, or reporting. It was not performed in this audit.

## Live cohort results

From the paid LP-3 launch through the audit timestamp, the first-party ledger contains **211** `ko_klaviyo` leads. All **211** were recorded as synchronized to Klaviyo. Of these leads, **73** supplied a phone number and positively checked the SMS-consent control. The other **138** did not provide explicit SMS consent and must not receive marketing SMS.

The Klaviyo profile audit found that **67 of the 73 consented people remain subscribed to SMS marketing**. Six have since unsubscribed, which is expected to be honored and should never be overridden.

| SMS delivery measure | Verified count | Interpretation |
|---|---:|---|
| Explicitly SMS-consented Unbounce leads | 73 | Eligible population only; no consent inferred from phone capture |
| Currently subscribed to SMS marketing | 67 | Six have unsubscribed since opt-in |
| Profiles with a post-opt-in `Sent Text Message` event | 6 | A text was sent to only 8.2% of consented leads |
| Outbound `Sent Text Message` events | 7 | Four labeled Day 0, one Day 1, and two without a retained message-name label |
| Profiles with a `Failed to Deliver Text Message` event | 3 | Delivery failure requires separate treatment from a successful send |
| Flow origin on recorded outbound SMS | `TvXwNj` | Confirms recorded texts came from the live KO SMS flow, not a campaign or unrelated automation |

> **Important distinction:** A `Sent Text Message` event confirms that Klaviyo attempted the outbound message. It is not proof that every recipient received it. The three explicit delivery failures mean the current evidence does **not** support saying that all consented LP-3 contacts are receiving SMS.

## Why the send gap is likely occurring

The Unbounce receiver calls the Klaviyo bridge for every valid lead. For an SMS-consented lead, that bridge currently performs these operations in this order:

1. It adds the profile to the **Interconnected Free Screening Opt-Ins** list.
2. That membership immediately triggers both live flows.
3. It then creates the separate Klaviyo SMS-subscription job.

The SMS flow has a live Day 0 message with no delay. Klaviyo therefore has an opportunity to evaluate its Day 0 SMS eligibility before the consent job completes. If the profile is not yet SMS-subscribed at that moment, Klaviyo appropriately skips the message. The later successful SMS subscription does not itself restart the already-triggered Day 0 action.

This is not an argument to send SMS without consent. The correction must preserve the existing affirmative checkbox requirement and only make the SMS consent record available **before** the list event that starts the flow.

## Required next step before treating SMS as operational

The safe technical correction is to reverse the two operations for explicitly consented contacts: submit the SMS subscription first, confirm acceptance from Klaviyo, and only then add the profile to the email-list trigger. The email path would remain unchanged for non-consented contacts.

This correction affects future SMS sends, so it should not be deployed without explicit approval. It also will not retroactively send Day 0 texts to the 67 currently subscribed people who were likely skipped. Any catch-up message would be a separate outbound communication decision and requires its own approval, exact copy, and suppression rules.

After approval and deployment, the correct validation is a **consent-only** test submission followed by an aggregate check for one SMS-subscription event, one Day 0 `Sent Text Message` event, and no unintended SMS to a non-consenting submission.

## References

[1]: https://www.klaviyo.com/flow/YyFZPu/edit "Klaviyo live Unbounce LP-3 email flow"

[2]: https://www.klaviyo.com/flow/TvXwNj/edit "Klaviyo live Unbounce LP-3 SMS flow"

[3]: https://try.theurbanmonk.com/interconnected-lp-3/ "Urban Monk Unbounce Interconnected LP-3"
