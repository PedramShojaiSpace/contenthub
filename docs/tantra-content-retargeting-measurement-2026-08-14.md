# Tantra Content-First Measurement and Retargeting Plan

## Objective hierarchy

| Phase | Meta optimization | Source signal | Decision rule |
|---|---|---|---|
| 1. Content discovery | Landing-page views | Standard PageView on each content destination | Measure cost per content visit, quiz-start rate, and registrar quality rather than raw click volume. |
| 2. Quiz behavior | CompleteRegistration | Fires when the visitor finishes the quiz questions | Compare registrants per content destination once each page has enough traffic for a directional read. |
| 3. Identified lead | Lead | Fires after email capture, with neutral content metadata only | Use as the downstream operating metric once sufficient lead volume exists. |
| 4. Revenue | Purchase | Confirmed paid order path | Evaluate content cohorts on qualified lead and paid revenue, not click-through rate alone. |

## Current implementation

The public Pixel automatically records a standard PageView. The quiz emits only standard events with neutral parameters:

| Event | Trigger | Parameters used |
|---|---|---|
| `CompleteRegistration` | Quiz questions completed | `content_name: Tantra Quiz Completed`; `content_category: tantra_quiz` |
| `Lead` | Email captured | `content_name: Tantra Quiz Results`; `content_category: tantra_quiz` |
| `InitiateCheckout` | Checkout intent | Standard product/price fields |
| `Purchase` | Confirmed payment | Standard commerce fields |

No quiz answers, diagnosis, symptom, medication, relationship status, or sexual-wellness result is sent in Pixel event parameters.

## Retargeting guardrail

Do **not** build a Meta audience segmented by a sensitive symptom, quiz result, health condition, or a page named for a private sexual-health concern. That would risk inferring sensitive personal information.

The safer first retargeting test is a **single broad Urban Monk education-engagement audience** (for example, public Page/Instagram engagement or approved non-sensitive video engagement) with generic relationship-education creative. It must not mention why a person engaged, infer a health or sexual condition, or name a sensitive page in the ad copy. Exclude current purchasers and keep the CTA at the education/quiz level.

> Before creating any audience from a specific health or sexual-wellness content URL, confirm its eligibility in Meta’s current audience-policy controls. The Content Hub does not create that sensitive audience automatically.

## Operating sequence

1. Create one **PAUSED** $2/day broad-US content campaign per approved page from the Content Traffic workspace. Its first ad set optimizes for landing-page views, not raw link clicks.
2. Launch only after reviewing the three creatives and destination page.
3. Keep initial optimization on landing-page views. Once a package has sufficient email-capture volume, duplicate the winner into a separate website-conversion test optimized for `Lead`; do not infer a conversion winner from a handful of events.
4. Compare each destination on content visits → CompleteRegistration → Lead → Purchase.
5. When an approved broad engagement audience reaches usable size, run a separate **PAUSED** quiz-retargeting campaign and review it before activation.
