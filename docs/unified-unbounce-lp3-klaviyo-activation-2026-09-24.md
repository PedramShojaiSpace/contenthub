# Unified LP-3 Klaviyo Activation and Kajabi Handoff

**Effective date:** 24 September 2026  
**Scope:** Unbounce LP-3 lead capture, unified Klaviyo nurture, Kajabi $99 checkout, Kajabi native post-purchase experience, and purchase suppression from the lead flow.

## Production routing

The live Unbounce LP-3 completion page is the Klaviyo treatment at `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`. Its first-party checkout bridge now directs the purchaser to the published Kajabi $99 entry checkout: `https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout`.

The Kajabi offer is configured with the existing **Interconnected Purchased — Redirect** post-purchase landing page and a native, published one-click-upselI stack. The first post-purchase offer is **Upstream: The Complete Microbiome Solution Upsell** at $99; the existing $199 testing offer remains a separate downstream option. Kajabi is the authority for payment, account creation, product access, post-purchase redirect, and its native upsells.

## Unified Klaviyo lead flow

The approved production candidate is **[DRAFT — JIM REVIEW] UNBOUNCE LP-3 — Interconnected Email + Consent-Only SMS** (`WaMDnA`). It has the same restricted list-add trigger as the prior LP-3 flows: **Interconnected Free Screening Opt-Ins**.

The flow contains eleven email actions, eleven native SMS-consent gates, eleven SMS actions, and ten original delay actions. All message links and timing were previously read back against the two former parallel flows. SMS remains conditional on current Klaviyo SMS-marketing subscription; a phone number by itself never qualifies a person for SMS.

## Buyer handoff and suppression

The Kajabi purchase webhook now has an explicitly enabled, exact-ID-only buyer handoff gate. A confirmed base purchase for either the $67 offer (`2151314475`) or the $99 entry offer (`2151402817`) sends the established buyer metric and records an `interconnected_kajabi_buyer` profile marker in Klaviyo. It does **not** subscribe a customer to email or SMS marketing and does **not** automatically enroll a customer in a separate Klaviyo buyer campaign.

Every outbound email and SMS action in `WaMDnA` has an additional filter requiring that the buyer marker is **not set**. Therefore, after the signed Kajabi webhook confirms a base purchase and records the marker, future lead-nurture emails and SMS are skipped. Kajabi remains responsible for fulfillment. No existing profile was backfilled, re-enrolled, or messaged during this configuration.

## Coordinated cutover conditions

The final cutover should set `WaMDnA` to **live** and set both former LP-3 flows to **draft** in the same change window:

| Flow | Required state after cutover | Purpose |
|---|---|---|
| `WaMDnA` | Live | Unified email + consent-only SMS for future LP-3 entrants |
| `YyFZPu` | Draft | Retire former parallel email flow for new entrants |
| `TvXwNj` | Draft | Retire former parallel SMS flow for new entrants |

Changing a flow status affects future qualifying entrants; no historic list member is added retroactively. The original SMS consent-order timing repair remains a separate production change and has not been made here. The unified flow’s native SMS gates prevent non-consented SMS sends even before that separate ordering repair is deployed.

## Required post-cutover observation

Review only aggregate operational evidence after the next organic LP-3 lead and buyer activity. Confirm that a new non-consenting lead receives email only, an explicitly consenting lead is eligible for the gated SMS path, and a confirmed Kajabi purchaser receives Kajabi fulfillment while later lead-nurture actions are skipped. Do not create a paid test order or send catch-up SMS without separate approval.
