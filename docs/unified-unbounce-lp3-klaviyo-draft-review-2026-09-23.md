# Unified Unbounce LP-3 Klaviyo Draft — Jim Review

**Status:** Draft only. No activation, traffic change, lead enrollment, message send, copy edit, timing edit, checkout change, or consent-order bridge change was made.

## Review conclusion

A new Klaviyo flow now combines the existing Unbounce LP-3 email nurture and consent-only SMS journey into one **reviewable draft canvas**. It is named **[DRAFT — JIM REVIEW] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** and is available at [Klaviyo flow `WaMDnA`](https://www.klaviyo.com/flow/WaMDnA/edit).

The draft uses the same event/list trigger as the two production flows: the `Tm5ejE` list-add metric filtered to **Interconnected Free Screening Opt-Ins**. It preserves 11 email positions and 11 SMS positions. Each email was copied to a separate draft template so reviewing or editing this draft cannot alter the live email sequence. Each message action is in **draft** status.

> The new draft sends an email first at each sequence position. It then evaluates one explicit native Klaviyo condition: the person must currently be subscribed to SMS marketing. Only the true branch reaches that position’s draft SMS. The false branch bypasses SMS and continues to the matching delay and next email. A supplied phone number alone does not meet this condition.

Klaviyo’s Flow API supports encoded draft flow definitions and temporary action identifiers, which is the mechanism used to create this isolated review flow. [1]

## What was preserved

| Source flow | Production status | Preserved content in the draft |
|---|---:|---|
| `YyFZPu` — **[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN** | Live | 11 email positions, sender and message settings, original cadence records, and separate cloned draft email templates |
| `TvXwNj` — **[LIVE — COMPLIANT SMS] Interconnected Free Screening - KO** | Live | 11 SMS positions, original SMS message settings, and original cadence records |

The two source flows were re-read after creation. Both remain **live** with their original 21-action sequences: the email flow still contains 11 emails and no SMS actions, and the SMS flow still contains 11 SMS actions and no email actions.

## Draft flow map

The draft contains 43 actions in a single linked sequence:

```text
Email 1 → SMS-consent gate 1 ── Yes → SMS 1 ─┐
                            └─ No ───────────┤→ Delay 1 → Email 2

Email 2 → SMS-consent gate 2 ── Yes → SMS 2 ─┐
                            └─ No ───────────┤→ Delay 2 → Email 3

…repeat through Email 10 / SMS 10 / Delay 10…

Email 11 → SMS-consent gate 11 ─ Yes → SMS 11 → End
                              └ No ─────────────────→ End
```

All eleven gates use the native condition **SMS marketing subscription = subscribed**, with `can_receive_marketing = true`. The true branch from every gate points to a draft SMS action. The false branch bypasses SMS. At positions 1–10, the SMS and non-SMS paths rejoin the same original delay before the next email. At the final position, both paths end after the final email or final permitted SMS.

## Quality-control readback

| Check | Result |
|---|---|
| New flow status | **Draft** |
| Trigger list | **Interconnected Free Screening Opt-Ins** |
| Total actions | **43** |
| Draft email actions | **11** |
| Draft SMS actions | **11** |
| Native SMS-consent gates | **11** |
| Delay actions | **10** |
| All 22 outbound actions are draft | **Passed** |
| Every consent gate requires current SMS marketing subscription | **Passed** |
| Every consent-true route points to draft SMS | **Passed** |
| Every consent-false route bypasses SMS | **Passed** |
| Every permitted SMS path rejoins the correct delay | **Passed** |
| Draft email templates isolated from live flow templates | **Passed** |
| Existing live email and SMS flows unchanged at post-create readback | **Passed** |

The builder compared all ten email and SMS delay definitions before creation and would have stopped if any timing value differed. This preserves the original cadence records while placing email and consent-gated SMS on the same review canvas.

## Jim’s review checklist

Jim should open the [draft flow canvas](https://www.klaviyo.com/flow/WaMDnA/edit) and confirm the following points visually before requesting any activation.

1. Confirm the title begins **[DRAFT — JIM REVIEW]** and the flow itself is marked **Draft**.
2. Confirm the trigger is the existing **Interconnected Free Screening Opt-Ins** event/list condition. Do not replace it with a broader list or a phone-number rule.
3. At each of the eleven positions, confirm the map is **Email → SMS marketing-consent split → permitted SMS or bypass → original delay**. The final position ends after the consent gate.
4. Open a representative early, middle, and final email. Confirm the visible copy, sender, CTA, and schedule match the intended live LP-3 email sequence. The template IDs are intentionally new because they are protected draft copies.
5. Open a representative early, middle, and final SMS. Confirm the body, organization settings, opt-out language, quiet-hour setting, and links match the existing consent-only SMS flow.
6. Confirm every email and SMS action remains **Draft**. Do not turn individual actions live during review.
7. Do not add anyone to the trigger list or send a test from the draft during this review.
8. Do not disable, edit, rename, or stop either current live flow while this draft is being reviewed.

## Activation is intentionally blocked

This draft is **not** the production consent-order repair. The current Unbounce bridge can place an explicitly consenting person into the trigger list before Klaviyo displays that person’s SMS marketing subscription. A separate, future change must safely complete the explicit SMS subscription before the list-trigger event is created. That change remains unapproved and was not implemented here.

Only after owner approval should the next phase occur: deploy and verify the consent-first bridge ordering, run a controlled consent-only and non-consent test with permission, activate this unified flow, and stop the two old live flows in one coordinated cutover to prevent duplicate messages. No historical contact should receive catch-up SMS without separate approval of the audience and copy.

## References

[1]: https://developers.klaviyo.com/en/reference/create_flow "Klaviyo Create Flow API"
