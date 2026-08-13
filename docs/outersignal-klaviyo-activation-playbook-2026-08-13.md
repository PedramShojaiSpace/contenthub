# OuterSignal → Klaviyo Activation Playbook

## Operating Principle

OuterSignal should not be allowed to spray additional messages across the list. Its role is to add a narrow set of **buyer-only context** to an existing Klaviyo profile, then make one better post-purchase or re-engagement decision than the generic program could make alone.

The initial workflow is therefore: **Shopify purchase → OuterSignal enrichment → a few approved Klaviyo properties → a targeted segment or controlled branch → one relevant message or a human follow-up.** Shopify and the Content Hub retain ownership of order value, source, UTM, consent, purchase history, and attribution.

Klaviyo supports custom profile properties for segmentation, flow filtering, and dynamic content. It can also branch a flow using profile properties, with the most-specific path evaluated first. [1] [2]

## Option Comparison

| Approach | What happens | Tradeoffs | Cost | Setup complexity |
|---|---|---|---:|---|
| **Native pilot — recommended** | Shopify app enriches buyers; OuterSignal writes approved properties/tags to Klaviyo and alerts the team for strategic buyers | Fastest path, but limited audit visibility in the Content Hub | Free trial, then Starter if eligibility fits | Low |
| **Hybrid intelligence layer — later** | OuterSignal sends a signed event to the Content Hub; the Content Hub saves a minimal approved record and then writes approved Klaviyo properties | Better audit trail and governance, but more integration work and likely more than one integration/playbook | Depends on vendor plan and build scope | Medium |

Start with the native pilot. Do not build the hybrid API route until the data proves useful and the native workflow identifies a specific limitation.

## The Only OuterSignal Fields to Put Into Klaviyo

Use the `um_os_` prefix so vendor enrichment never collides with Shopify, Kajabi, quiz, or Content Hub fields. Do **not** copy raw addresses, property values, detailed location, raw social URLs, or health-related inference into Klaviyo.

| Klaviyo property | Type | Example value | Purpose |
|---|---|---|---|
| `um_os_status` | text | `matched`, `unmatched`, `review_required` | Data-quality gate |
| `um_os_enriched_at` | datetime/text | ISO timestamp | Troubleshooting and expiry |
| `um_os_activation_eligible` | boolean | `true` | Explicit safeguard before any automation uses enrichment |
| `um_os_persona` | text | Vendor-generated persona value | One controlled communication branch at a time |
| `um_os_vip` | boolean | `true` | Human review, never bulk personalization |
| `um_os_influencer` | boolean | `true` | Human partnership / earned-media review |
| `um_os_b2b_opportunity` | boolean | `true` | Human practitioner, retail, or partnership review |
| `um_os_occupation_category` | text | Broad category only | Optional analysis; not a first-pilot email trigger |
| `um_os_social_reach_band` | text | `10k_to_50k` | Optional manual review priority |

OuterSignal should write a property only after a profile meets the pilot's confidence/quality criteria. Values should be overwritten with the latest approved enrichment, not accumulated as uncontrolled tags.

## Segments to Build in Klaviyo

Create the following as **Draft / unconnected segments** first. Do not attach a live flow until the team has inspected examples.

| Segment | Logic | What happens next |
|---|---|---|
| `UM OS — Enriched Eligible Purchasers` | Has placed a Shopify order AND `um_os_status=matched` AND `um_os_activation_eligible=true` | Entry point for the controlled communication pilot |
| `UM OS — Strategic Buyer Review` | Any of `um_os_vip`, `um_os_influencer`, or `um_os_b2b_opportunity` is true | Team alert and human review; no automatic offer escalation |
| `UM OS — Persona Pilot: [actual persona]` | Eligible purchaser AND one selected `um_os_persona` value | One 50/50 generic-versus-tailored communication test |
| `UM OS — Enriched No Repeat Purchase, 30 Days` | Eligible purchaser AND no additional Shopify order in 30 days | Later re-engagement test; do not activate in month one |
| `UM OS — Data Review Required` | `um_os_status=review_required` or enrichment stale/blank | Exclude from automation and spot-check manually |

Klaviyo can start a flow when a profile newly enters a segment because a profile or event change caused that membership. Use no re-entry for the first test so a customer receives the pilot only once. [3]

## The First Communication Test

Do **not** use OuterSignal to rewrite the nine-day Interconnected delivery sequence or the Day 0 offer. That is a separate conversion experiment and should stay stable.

Use a new, Draft-only **Post-Purchase Buyer Insight Pilot** flow:

1. **Trigger:** Added to `UM OS — Enriched Eligible Purchasers`.
2. **Guardrail:** The profile must be email-marketing eligible and must have a paid Shopify order; exclude refunds/cancellations as appropriate.
3. **Delay:** Wait long enough for the purchase event and enrichment properties to settle; start with 24 hours for the pilot.
4. **Branch:** First route `UM OS — Strategic Buyer Review` to a human-alert path with no automatic special discount. Then run the selected persona through a controlled 50/50 split.
5. **Control message:** The existing generic post-purchase value email, unchanged except for required tracking.
6. **Tailored message:** Same offer, sender, send time, and number of links as the control. Change only the framing, examples, and next-best educational resource to match the validated persona insight. Do not mention inferred demographics, occupation, property data, or “we know who you are.”
7. **Measurement:** Compare delivered rate, click rate, conversion rate, revenue per recipient, repeat-purchase rate, unsubscribe rate, and complaint rate. The decision metric is **incremental revenue per recipient**, not open rate.

For an Interconnected buyer, the tailored message can recommend the most relevant next educational asset or a next-step offer from the existing product ladder. For a Tantra purchaser, it should support the existing couples-reconnection narrative and not infer sexual-health details. For all flows, use only the recipient’s existing consent status.

## Human Follow-Up Workflow

OuterSignal creates its clearest potential value when it finds a real opportunity that deserves a human response.

| Signal | Automatic action | Human action within one business day |
|---|---|---|
| VIP / creator | Alert only | Review accuracy; send a genuine thank-you or partnership invitation only if appropriate |
| Practitioner / retailer / B2B signal | Alert only | Review product fit; route to wholesale, referral, or professional-relationship outreach |
| High-reach buyer | Alert only | Evaluate affiliate, earned-media, or collaboration potential |
| Persona only | No alert | Use only in the controlled email test |

No enriched field should create an automatic aggressive sales message, a special discount, or a health-condition claim.

## Meta Use: Phase Two Only

After a clean buyer cohort exists, test one buyer-derived seed audience against the existing comparable audience. Use purchase history and approved broad persona membership to define the seed; do not export sensitive attributes or target people based on inferred health characteristics. Keep the current ad set as control and compare cost per purchase and revenue per dollar spent.

## First 30 Days

| Timing | Action | Decision gate |
|---|---|---|
| Days 1–3 | Install trial; enrich Shopify purchasers only; inspect 25 profiles | Stop if data quality is poor or uncertain |
| Days 4–7 | Finalize property names and Draft segments; configure strategic-buyer alerts | Do not connect live flow yet |
| Days 8–30 | Activate one controlled post-purchase persona test | Continue only if incremental revenue or strategic opportunities appear without engagement damage |
| Day 30 | Review results | Keep Starter, upgrade only for proven multi-integration/API need, or stop |

## Vendor Confirmation Checklist

Before activation, confirm with OuterSignal whether its native Klaviyo connection can write exactly the namespaced profile properties above; whether the trial allows historical buyer enrichment and native Klaviyo activation; how it refreshes or deletes data; what confidence/quality status is available; and whether Shopify plus Klaviyo counts as one or multiple plan integrations. The vendor publicly describes two-way Shopify/Klaviyo synchronization, API, and webhooks, but these workflow details are not publicly specified. [4]

## Sources

[1] [Klaviyo: Understanding custom profile properties](https://help.klaviyo.com/hc/en-us/articles/115000250912), accessed 2026-08-13.

[2] [Klaviyo: Understanding flow branching](https://help.klaviyo.com/hc/en-us/articles/115003883992), accessed 2026-08-13.

[3] [Klaviyo: Segment- or list-triggered flows](https://help.klaviyo.com/hc/en-us/articles/360003040052), accessed 2026-08-13.

[4] [OuterSignal: Activation and integration claims](https://www.outersignal.com/compare/mercana), accessed 2026-08-13.
