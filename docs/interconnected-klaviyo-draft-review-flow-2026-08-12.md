# Interconnected Klaviyo Draft Review Flow — 2026-08-12

## Review Flow

The VA review flow is a complete separate clone of the live **[EG] Interconnected Free Screening - KO** flow:

| Item | Value |
|---|---|
| Draft flow name | `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` |
| Klaviyo flow ID | `YyFZPu` |
| Direct review URL | `https://www.klaviyo.com/flow/YyFZPu/edit` |
| Flow status | Draft |
| Total actions | 66 |
| Email and SMS actions | 40, all Draft |
| Live source flow | `[EG] Interconnected Free Screening - KO` (`VMpbLV`) |

The draft flow preserves the source trigger, sequence, delays, email/SMS pattern, and message structure. The live flow was not edited, paused, replaced, or deleted.

On 2026-08-13, browser verification confirmed the owner had changed the review flow itself to **Live** and had made only its first email, **Day 0 opt in EG sp26**, Live. The adjacent Day 0 SMS remained Draft. This state change was owner-initiated; no other message status was changed by this task.

Browser verification confirmed the direct review URL opens the separate flow with a visible **Draft** status. Its first visible email, **Day 0 opt in EG sp26**, also displays a **Draft** status in the flow canvas.

## Day 0 Revision in the Draft Flow

The Day 0 message is held as Draft and uses the approved clean treatment: one button labelled **“Redeem your one-time $67 offer”**, one clearly stated one-time-price sentence, and one first-party tracked checkout destination. The message does not include repeated CTAs, a countdown, P.S., or P.P.S. content.

The first-party destination is tagged as follows:

| Parameter | Value |
|---|---|
| `utm_source` | `klaviyo` |
| `utm_medium` | `email` |
| `utm_campaign` | `interconnected_14day` |
| `utm_content` | `day0_one_time_67_offer` |

## Full Draft Sequence Standardization

All 27 draft emails now use the same compact warm-neutral reading frame as the Day 0 email. The legacy coral/red canvas, redundant navigation and social links, repeated buttons, and extra footer clutter were removed from the review-flow emails. Each message now preserves one primary action link, selected from its original episode, replay, offer, or other main destination; the Day 0 email remains the approved one-time $67 offer treatment.

The Draft Day 0 SMS now reads:

> Interconnected starts tomorrow. Daily episode links are on the way. One-time $67 all-access offer: `https://content.theurbanmonk.com/r/ic67`

The short first-party `/r/ic67` link preserves attribution through the existing checkout bridge with the `sms` medium and `day0_sms_one_time_67_offer` content tag. It was added only to the Draft Day 0 SMS.

## Sender, Signature, and Footer Treatment

Every draft email action now uses **Interconnected Series by The Urban Monk** as its sender name. Each email closes with **Dr. Pedram Shojai** and the line **Host of the Interconnected Series** directly beneath the name. The recipient-visible mailing-list boilerplate and address text that were unintentionally introduced during the draft conversion were removed from the message bodies. Each email retains its required Klaviyo unsubscribe mechanism.

## VA Review Checklist

1. Open the direct review URL above and confirm the banner says **Draft**.
2. Review the Day 0 email first. Confirm the single $67 button, no duplicate CTA, and correct mobile spacing.
3. Review Day 1 and the remaining draft emails. Each should use the same warm neutral frame, no coral/red background, one primary button, and no social/navigation-link strip.
4. Confirm the Draft Day 0 SMS contains the concise `content.theurbanmonk.com/r/ic67` one-time-offer link.
5. Confirm each email sender is **Interconnected Series by The Urban Monk** and that each signature reads **Dr. Pedram Shojai** followed by **Host of the Interconnected Series**.
6. Review the remaining draft email and SMS messages in order against the current live flow; timing and sequence should match, while no action should be activated.
7. Do **not** change the live flow or click any activation control. The owner will decide whether and how to replace the live flow after review.
