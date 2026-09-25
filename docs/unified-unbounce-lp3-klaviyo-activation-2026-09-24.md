# Unified LP-3 Klaviyo Cutover and Kajabi Fulfillment

**Effective date:** 24 September 2026
**Status:** **Live for future Unbounce LP-3 entrants**
**Scope:** Unbounce LP-3 form routing, the unified Klaviyo email-and-consent-only-SMS nurture, the $99 Kajabi checkout, native Kajabi upsells, and the Kajabi buyer lifecycle.

## Executive record

The owner approved activation after Jim’s review. The live Unbounce LP-3 form now sends **only future opt-ins** to an isolated Klaviyo list that triggers a single unified lead flow. This preserves the earlier live flows for their existing in-progress cohort while preventing all future LP-3 entrants from entering any legacy flow.

> **No historical person was moved, re-enrolled, or messaged during this cutover. No test purchase was created.**

The $99 Kajabi buyer path is also active: a confirmed purchase grants the Interconnected product, passes the purchaser through Kajabi’s existing post-purchase path and native OCU stack, and enrolls that purchaser in the reviewed Kajabi buyer sequence. A confirmed base buyer is simultaneously marked in Klaviyo so future lead-nurture messages are suppressed.

## Live route map

| Stage | Live configuration | Verified behavior |
|---|---|---|
| Paid/Unbounce opt-in | `https://try.theurbanmonk.com/interconnected-lp-3/` embeds Klaviyo form `SJAKDW` | The form’s **published** version submits only to `[LIVE — UNIFIED] Interconnected LP-3 Opt-Ins` (`VWhddE`). |
| Lead nurture | Klaviyo flow [`THZhTS`](https://www.klaviyo.com/flow/THZhTS/edit) — **[LIVE — ACTIVE] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** | Live, list-filtered to the isolated intake list; 11 email actions, 11 SMS actions, and 11 native SMS-marketing-consent gates. |
| Thank-you / checkout | `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo` | The public page shows the $99 treatment and all purchase CTAs use the tracked `/r/checkout` bridge. |
| Kajabi checkout | `https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout` | The bridge returns a 302 to the intended published $99 checkout with the Klaviyo attribution parameters intact. |
| Buyer fulfillment | Kajabi offer `2151402817` — **Interconnected $99 Bundle OTO** | Published; grants **Interconnected Series Self Guided** product access, uses the existing **Interconnected Purchased — Redirect** post-purchase landing page, and has the native $99 Upstream OCU first, followed by the existing $199 testing offer. |
| Buyer email lifecycle | Kajabi sequence `2148891667` — **[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99** | Now has exactly **one live subscribe trigger**: `Offer is purchased: Interconnected: The Complete Healing Protocol` for the exact $99 base offer. It had 0 subscribers and 0 sent messages at activation. |

The visible `[DRAFT]` text in the Kajabi sequence title is an old administrative label only. Its one exact-offer purchase trigger is active. The title was intentionally left unchanged during this activation so there was no unrelated rename while the behavior changed.

## Isolation and duplicate-prevention design

The original live flows were **not** switched to draft because the owner required their existing traffic cohort to continue uninterrupted. They remain live but are triggered only by the former list, **Interconnected Free Screening Opt-Ins**. The published form no longer submits to that list.

| Flow | Current status | Trigger list | Role after cutover |
|---|---:|---|---|
| `THZhTS` — **[LIVE — ACTIVE] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** | Live | `[LIVE — UNIFIED] Interconnected LP-3 Opt-Ins` | Only flow for future LP-3 form submissions. |
| `WaMDnA` — **MAIN IC OPT IN UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** | Live | `Interconnected Free Screening Opt-Ins` | Existing cohort only; it receives no new form submission after this cutover. |
| `YyFZPu` — **[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN** | Live | `Interconnected Free Screening Opt-Ins` | Existing email cohort only. |
| `TvXwNj` — **[LIVE — COMPLIANT SMS] Interconnected Free Screening - KO** | Live | `Interconnected Free Screening Opt-Ins` | Existing SMS cohort only. |

The post-cutover verification confirmed the form has one live version pointing only to the isolated list, the isolated unified flow has 22 live outbound messages and 11 consent gates, and none of the three legacy flows point to the isolated list.

## Consent and buyer suppression safeguards

Every SMS decision in `THZhTS` is behind a native Klaviyo condition requiring the profile to be currently subscribed to **SMS marketing**. A supplied phone number never implies SMS permission. All 11 SMS gates were read back as requiring `channel = sms`, `can_receive_marketing = true`, and `subscription = subscribed`.

Every email and SMS in `THZhTS` also has a buyer-suppression condition requiring the profile property `interconnected_kajabi_buyer` to be **not set**. The enabled exact-ID Kajabi webhook handoff recognizes only the $67 base offer (`2151314475`) and the $99 base offer (`2151402817`) as Interconnected base buyers. After Kajabi confirms the purchase, it records the buyer marker in Klaviyo without subscribing the person to email or SMS marketing. Future lead-nurture actions are then skipped while Kajabi owns fulfillment.

## Buyer sequence trigger

The Kajabi buyer lifecycle now starts only when the current $99 **base offer** is purchased. It does **not** start merely because someone opts in, and it does **not** use the $99 Upstream OCU as a second sequence-entry trigger. This avoids restarting the buyer sequence after the native OCU is accepted.

The first buyer email remains scheduled immediately after purchase and the rest retain the approved cadence already configured in Kajabi. The buyer sequence had zero subscribers before activation; therefore, the new trigger does not backfill prior purchasers.

## Operational observation

Use aggregate operational evidence after the next organic entrant and confirmed buyer activity. Verify all of the following without creating a paid test order or sending catch-up SMS:

1. A new non-consenting LP-3 lead is counted only on the isolated intake list and receives the email path, not SMS.
2. An explicitly SMS-consenting LP-3 lead is eligible for the gated SMS path only after Klaviyo recognizes current marketing consent.
3. A $99 base purchaser receives Kajabi product access, the configured post-purchase page, the native OCU opportunity, and the Kajabi buyer sequence.
4. The confirmed buyer’s future unified lead-nurture email/SMS actions are suppressed by the Kajabi buyer marker.

## References

[1]: https://www.klaviyo.com/flow/THZhTS/edit "Live unified LP-3 Klaviyo flow"

[2]: https://app.kajabi.com/admin/email_sequences/2148891667 "Kajabi buyer lifecycle sequence"

[3]: https://app.kajabi.com/admin/offers/2151402817/upsells "Kajabi $99 Interconnected offer purchase flow"

[4]: https://content.theurbanmonk.com/interconnected/thank-you-klaviyo "Live Klaviyo thank-you page"
