# Unified LP-3 Klaviyo Cutover and Kajabi Fulfillment

**Effective date:** 24 September 2026
**Current status:** **Unified $99 flow is live; legacy $67 delivery is contained.**
**Scope:** Unbounce LP-3 opt-in routing, the unified Klaviyo email-and-consent-only-SMS nurture, the $99 Kajabi checkout, Kajabi native upsells, and Kajabi buyer fulfillment.

## Current operational state

The active intended journey is the unified Klaviyo flow, [`THZhTS`](https://www.klaviyo.com/flow/THZhTS/edit): **[LIVE — ACTIVE] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS**. It contains 11 live emails and 11 live SMS actions. Its Day 0 SMS explicitly references the **$99** offer, not the former $67 offer. All 11 email actions have Smart Sending disabled.

An owner test revealed residual ingestion into the former **Interconnected Free Screening Opt-Ins** list (`Rrx44Q`). That list triggered a separate, wrong-offer $67 automation, `WaMDnA` — **MAIN IC OPT IN UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS**. At the time of discovery, its Day 0 SMS explicitly referenced $67.

> **Containment completed:** all 22 outbound actions in `WaMDnA` are now draft. The two earlier legacy flows, `YyFZPu` and `TvXwNj`, are also draft with no live outbound actions. No LP-3 entrant can now receive a $67 email or SMS from those legacy flows.

No historical person was moved or re-enrolled, and no paid test purchase was created.

## Intended $99 route

| Stage | Current configuration | Verified behavior |
|---|---|---|
| Opt-in page | `https://try.theurbanmonk.com/interconnected-lp-3/` | Native Unbounce form collects email, an optional phone, and a separate SMS-consent checkbox. |
| Unified intake list | `VWhddE` — **[LIVE — UNIFIED] Interconnected LP-3 Opt-Ins** | This is the only intended list for future LP-3 lead nurture. |
| Lead nurture | [`THZhTS`](https://www.klaviyo.com/flow/THZhTS/edit) | Live; 11 email actions and 11 consent-gated SMS actions. Day 0 SMS carries the $99 offer. |
| Thank-you / checkout | `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo` | Public page routes every purchase CTA through the tracked $99 checkout bridge. |
| Kajabi checkout | `https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout` | Published $99 Interconnected base offer. |
| Kajabi native OCU | Offer `2151402817` | Native purchase flow shows the $99 Upstream OCU first, then the existing $199 testing offer. |
| Buyer fulfillment | Kajabi sequence `2148891667` | The reviewed buyer lifecycle starts only when the exact $99 base offer is purchased. |

## Legacy-flow containment

| Flow | Current message status | What it means now |
|---|---:|---|
| `THZhTS` — **[LIVE — ACTIVE] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** | 22 live | The single authorized LP-3 nurture sequence. |
| `WaMDnA` — **MAIN IC OPT IN UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** | 22 draft | Former $67 offer sequence; intentionally paused after the wrong-offer SMS incident. |
| `YyFZPu` — **[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN** | 11 draft | Earlier email-only sequence; not delivering. |
| `TvXwNj` — **[LIVE — COMPLIANT SMS] Interconnected Free Screening - KO** | 11 draft | Earlier SMS-only sequence; not delivering. |

## LP-3 ingestion safeguards

The application handoff now creates **email marketing consent before unified-list enrollment** for a completed Unbounce email opt-in. If the person separately checks the SMS box and supplies a phone, it creates **SMS marketing consent before list enrollment**. This order prevents an immediate Day 0 action from being evaluated before the appropriate consent state exists.

The browser bridge now calls the Klaviyo enrollment helper rather than merely marking an internal lead record as synced. A failure to hand off to Klaviyo is surfaced as a failure rather than being treated as successful enrollment.

The native Unbounce form is still creating some legacy-list entries in `Rrx44Q`. The old sequence has been contained, so those entries can no longer result in $67 messages. The remaining configuration task is to remove or redirect the legacy native Unbounce-to-Klaviyo destination so that future entrants appear only on `VWhddE`. This is a data-hygiene correction, not a delivery-risk blocker while the legacy actions remain draft.

## Consent and buyer-suppression safeguards

Every SMS decision in `THZhTS` is behind a native Klaviyo condition requiring the profile to be currently subscribed to **SMS marketing**. A supplied phone number never implies SMS permission.

Every email and SMS in `THZhTS` also has a buyer-suppression condition requiring the profile property `interconnected_kajabi_buyer` to be **not set**. The exact-offer Kajabi purchase receiver recognizes only the $67 base offer (`2151314475`) and the $99 base offer (`2151402817`) as Interconnected base buyers. After Kajabi confirms the purchase, it records the buyer marker in Klaviyo without changing marketing consent; future lead-nurture messages are then skipped while Kajabi owns fulfillment.

## Next verification sequence

Without creating a paid test order or sending catch-up SMS, verify the next genuine LP-3 opt-in as follows:

1. Confirm the profile enters `VWhddE` and receives the Day 0 unified email.
2. For a person with affirmative SMS consent, confirm only the $99 Day 0 SMS sends from `THZhTS`.
3. Confirm no message is sent from `WaMDnA`, `YyFZPu`, or `TvXwNj`; their message actions are draft.
4. Confirm a $99 base purchaser receives Kajabi product access, its native OCU opportunity, and the buyer sequence; thereafter, confirm future unified nurture is suppressed by the Kajabi buyer marker.

## References

[1]: https://www.klaviyo.com/flow/THZhTS/edit "Live unified LP-3 Klaviyo flow"
[2]: https://www.klaviyo.com/flow/WaMDnA/edit "Paused legacy $67 flow"
[3]: https://app.kajabi.com/admin/email_sequences/2148891667 "Kajabi buyer lifecycle sequence"
[4]: https://app.kajabi.com/admin/offers/2151402817/upsells "Kajabi $99 Interconnected offer purchase flow"
[5]: https://content.theurbanmonk.com/interconnected/thank-you-klaviyo "Live Klaviyo thank-you page"
