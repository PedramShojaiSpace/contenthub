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

## VA Review Checklist

1. Open the direct review URL above and confirm the banner says **Draft**.
2. Review the Day 0 email first. Confirm the single $67 button, no duplicate CTA, and correct mobile spacing.
3. Review the remaining draft email and SMS messages in order against the current live flow; timing and sequence should match, while no action should be activated.
4. Do **not** change the live flow or click any activation control. The owner will decide whether and how to replace the live flow after review.
