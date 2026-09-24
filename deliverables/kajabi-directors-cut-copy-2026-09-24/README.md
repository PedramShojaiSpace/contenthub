# Kajabi Director’s Cut and Upstream Copy Packet

## What this packet changes

This packet separates the two offers cleanly:

- **Interconnected $67 / $99 offers:** The Director’s Cut is a concrete bonus that makes the standalone Interconnected purchase more compelling.
- **$99 Upstream OCU:** Upstream is presented as its own deeper, structured course. It does **not** rely on the Director’s Cut as a reason to upgrade.

## Required fulfilment gate before publishing the Director’s Cut promise

The current $67 offer `2151314475` and $99 offer `2151402817` each include **Interconnected Series Self Guided** only. The Director’s Cut sits in a different course: **Interconnected Series Full**.

Before publishing either Director’s Cut HTML block, add **Interconnected Series Full** to both offers, save the offer, and choose the option that makes the new product available to the buyer population you intend to serve. Then verify, with an internal entitled account, that the buyer library shows **Interconnected Series Full** and that the published **Director’s Cut** module opens.

Do not duplicate the Director’s Cut as a new course or product. It is a published module inside **Interconnected Series Full**.

## Where to paste each file

| File | Kajabi location | Use |
|---|---|---|
| `01-interconnected-offer-description.html` | Sales → Pricing → **Interconnected $67 Bundle OTO** or **Interconnected $99 Bundle OTO** → Details → Description | Replace the current short description on **both** Interconnected offers. |
| `02-interconnected-sales-page-bonus-section.html` | The matching Interconnected Kajabi sales/check-out page’s custom-code or HTML section | Place directly below the primary series/value explanation and above the final checkout CTA. |
| `03-upstream-ocu-standalone-section.html` | $99 Upstream OCU page custom-code or HTML section | Use for the native post-purchase Upstream offer. It has no Director’s Cut dependency. |
| `04-upstream-ocu-offer-description.html` | Sales → Pricing → **Upstream Bundle OCUS: The Complete Microbiome Solution with Testing [OCUS ONLY]** → Details → Description | Replace the existing short Upstream offer description. |

## Quick quality-control pass

1. Reopen each edited page after saving and verify no raw tags or missing bullets appear.
2. Confirm the phrase **Director’s Cut** appears only on the Interconnected $67/$99 offer/page—not as the primary reason to buy Upstream.
3. Confirm the $99 Upstream OCU remains $99 and its price, checkout, upsell sequence, and automations are otherwise unchanged.
4. Confirm that both $67 and $99 buyers can actually open **Interconnected Series Full → Director’s Cut** before running traffic to the new promise.
5. Do not create a paid test order. An internal entitled-account library check is sufficient for this content/access QA.

## Current source-of-truth context

- Interconnected $67 offer: `2151314475` — currently one product, **Interconnected Series Self Guided**.
- Interconnected $99 offer: `2151402817` — currently one product, **Interconnected Series Self Guided**.
- Upstream $99 OCU: `2151104453` — already includes **Upstream: The Complete Microbiome Solution**, **Interconnected Series Full**, and **Gut Check Series**.
- Director’s Cut: a published module inside **Interconnected Series Full**.

No offer, access, copy, checkout, price, automation, buyer, or traffic setting is changed by this packet. It is ready for manual paste and review.
