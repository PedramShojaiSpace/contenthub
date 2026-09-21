# Upstream Course and Navigator Offer Architecture

**Author:** Manus AI  
**Date:** 21 September 2026  
**Status:** Draft implementation brief. No sales page, Kajabi product, offer, checkout, price, upsell, email, or traffic setting has been changed.

## Executive decision

The revised offer ladder should separate the **Upstream Course** from the higher-touch **Upstream Navigator**. The course becomes the accessible standalone education product at **\$199**. The Navigator becomes the premium, clearly differentiated path at **\$499**. The course may also appear as a **\$99 one-time post-purchase offer** after a qualifying front-end purchase.

The strategic advantage is clarity. The customer sees one self-guided educational product and one higher-level option, rather than being asked to infer why two similarly named offers exist. The \$99 price is not a third course. It is a restricted post-purchase price for the **same Upstream Course entitlement**.

> **Naming rule:** Do not use the phrase “Complete System” for the \$499 Upstream offer. On this offer ladder, **\$499 means Upstream Navigator**. This avoids colliding with the earlier Interconnected “Complete System” concept.

## Recommended offer and entitlement map

| Layer | Customer-facing name | Price | Kajabi structure | Who sees it | Required entitlement |
|---|---|---:|---|---|---|
| Core product | **Upstream Course** | N/A | One Kajabi Product | Anyone who buys any Course offer | The complete self-guided Upstream curriculum and only the confirmed included resources. |
| Standard course offer | **Upstream Course — Standard Access** | \$199 one time | One Kajabi Offer attached to the Upstream Course product | Dedicated Upstream sales page, qualified organic follow-up, and approved direct traffic | Access to the Upstream Course. |
| Post-purchase offer | **Upstream Course — Front-End Buyer OCU** | \$99 one time | A second Kajabi Offer attached to the **same** Upstream Course product, used by a Kajabi upsell page | Only the approved qualifying front-end buyer immediately after purchase | Exact same Upstream Course access as the \$199 offer. |
| Premium path | **Upstream Navigator** | \$499 one time | A separate Kajabi Offer. Attach the Upstream Course plus a second product only if Navigator has genuinely distinct, deliverable content or service. | Dedicated Navigator sales page and approved qualified follow-up | Upstream Course plus the verified Navigator-specific entitlement. |

Kajabi’s offer model supports one or more products per Offer, so the \$499 Navigator can bundle the Course with a distinct Navigator product when that distinction is real. It is not necessary, or desirable, to create duplicate Course products merely to support different prices. [1]

## Funnel map

![Upstream Course and Navigator offer flow](./upstream-course-navigator-offer-flow-2026-09-21.png)

### 1. Dedicated Upstream acquisition and direct sales

The **Upstream sales page** should present two clean choices after the program has been explained.

| Choice | Intended buyer | CTA | Destination |
|---|---|---|---|
| **Upstream Course — \$199** | “I want the self-guided framework and I am ready to begin on my own.” | **Start Upstream** | Kajabi \$199 Course Offer checkout |
| **Upstream Navigator — \$499** | “I want the Upstream framework plus the specific Navigator support and resources.” | **Choose Upstream Navigator** | Kajabi \$499 Navigator Offer checkout |

The Course and Navigator pages should explain the difference in an explicit comparison. The Navigator page must not claim any element that has not been confirmed as included and deliverable.

### 2. Qualifying Kajabi front-end purchase

For the existing Kajabi front-end offers, create a single \$99 **Upstream Course OCU** in Kajabi’s Upsell library, then attach it only to the approved qualifying source offer or offers. The current Kajabi environment has distinct \$67 and \$99 Interconnected entry offers, so the final setup must identify which one—or both—should show the OCU before it is attached.

Kajabi states that an upsell is presented after the source checkout and accepted as a separate transaction using the original purchase method. This is appropriate for a \$99 one-time post-purchase Course offer. [2] [3]

### 3. Shopify LP-3 purchase

Do **not** attach the \$99 Kajabi Course OCU to the Shopify/Zipify funnel until a reliable entitlement design is approved and verified. A Shopify payment does not by itself grant a buyer access to a Kajabi Product. The possible paths are:

| Option | Customer experience | Strength | Constraint |
|---|---|---|---|
| Keep the \$99 OCU Kajabi-only initially | Eligible Kajabi front-end buyers see the native Kajabi upsell and receive course access automatically. | Fastest and cleanest first launch. | Shopify LP-3 buyers do not see this OCU yet. |
| Sell a \$99 Shopify OCU and grant Kajabi access through an approved integration | Shopify buyer accepts an OCU, then receives the Course entitlement in Kajabi. | Creates parity across checkout platforms. | Requires a tested, idempotent payment-to-entitlement integration, customer identity matching, access-email ownership, refund/revocation plan, and a failure-recovery process. |
| Send Shopify buyers to a post-purchase \$99 Kajabi checkout | Buyer sees a \$99 follow-up CTA and purchases in Kajabi. | No entitlement bridge is required. | It is a second checkout, not a true one-click upsell. |

The recommended first release is **Kajabi-only for the \$99 OCU**, while the Shopify path remains separate until its entitlement handoff is tested. This avoids selling digital access that may not be granted correctly.

## Price and upgrade policy

The standard pricing relationships are simple:

| Buyer position | Offer shown | Suggested handling |
|---|---:|---|
| New direct Course buyer | \$199 Course | Full Course access. |
| Qualified front-end buyer | \$99 OCU Course | Full Course access at the restricted post-purchase price. |
| New Navigator buyer | \$499 Navigator | Full Course plus the confirmed Navigator entitlement. |
| Existing \$199 Course buyer who wants Navigator | \$300 upgrade, if full price credit is approved | Do not make this buyer repay for the Course. |
| Existing \$99 OCU Course buyer who wants Navigator | \$400 upgrade, if full price credit is approved | Do not make this buyer repay for the Course. |

The two upgrade rows are a **recommended policy**, not a live price instruction. Decide whether you want to credit prior Course payments fully before creating upgrade offers. If the policy is not approved, the Navigator sales page must not imply automatic credit.

## Sales-page requirements

### Upstream Course \$199 page

The Course page should introduce the Upstream framework before presenting price. It should state exactly what is included, who the self-guided experience is for, how the learning path is organized, what the buyer can expect immediately after purchase, and what the Course is **not**. It should treat health education carefully: no diagnosis, cure, treatment, or guaranteed-outcome claims.

The page must show the Course as a complete standalone path. It should not position the \$199 purchase as an incomplete teaser that only becomes useful at \$499.

### Upstream Navigator \$499 page

The Navigator page should open with the problem that Navigator solves: a buyer who wants the Course plus the specifically named additional layer of support. It must then list the confirmed Course entitlement and the confirmed Navigator-only entitlements separately.

Do not use “personalization,” “guidance,” “navigation,” “support,” “community,” “consultation,” or “implementation help” as vague sales language. Each term must resolve to a specific deliverable, owner, cadence, access duration, and boundary.

### \$99 post-purchase OCU page

The OCU should be short. It should say that the purchaser has just taken the first step, explain why Upstream is the logical next educational layer, display the normal \$199 price and the one-time \$99 post-purchase price, list only confirmed Course inclusions, and present a clear **Yes, add Upstream for \$99** action and a respectful decline action.

The OCU should not use an invented countdown, fabricated scarcity, a fake “special” justification, or claims that the purchaser will miss a health outcome. Any time-based restriction must be technically true and documented.

## Facts that must be locked before public release

| Decision | Why it matters |
|---|---|
| Exact Upstream Course curriculum, bonuses, downloads, and duration of access | Determines what the \$199 and \$99 offers may truthfully promise. |
| Exact Navigator-only inclusions | Determines whether Navigator needs a second Kajabi product and how the \$499 difference is explained. |
| Navigator delivery owner, cadence, access duration, and cancellation/refund terms | Prevents a premium offer with vague fulfillment. |
| Whether Course buyers receive full credit toward Navigator | Determines the later upgrade path and pricing language. |
| Which Kajabi source offer(s) trigger the \$99 OCU | Prevents a \$99 offer from being shown in the wrong funnel. |
| Whether the \$99 OCU is one time per purchaser and how repeat buyers are excluded | Prevents duplicate access and unwanted repeat charges. |
| Exact checkout URLs, product IDs, offer IDs, and approved post-purchase pages | Required for safe CTA maps and measurement. |
| Guarantee and terms language | Must be factual and consistent across the Course, Navigator, OCU, checkout, and follow-up email. |
| Shopify-to-Kajabi entitlement approach | Required before a Shopify buyer is ever shown a paid Kajabi-access promise. |

## Measurement contract

Keep the offer records distinct. Track **\$199 Course**, **\$99 Course OCU**, **\$499 Navigator**, and any later Course-to-Navigator upgrade as separate offer paths. Do not collapse the \$99 OCU into the \$199 Course revenue line; it must be visible as a separate post-purchase conversion rate and average-order-value contribution.

Kajabi should remain the financial source of truth for purchases processed in Kajabi. Shopify should remain the financial source of truth for purchases processed in Shopify. A cross-platform entitlement bridge, if later approved, should record the original transaction source and should not create a second revenue event.

## Copy-ready implementation prompt

```text
We are updating the Urban Monk’s Upstream offer architecture. Work in the existing project and its connected Kajabi account. Do not create a new project.

The commercial decision is final:
- Upstream Course is the standalone self-guided offer at \$199 one time.
- Upstream Navigator is the premium, distinct offer at \$499 one time.
- Upstream Course is also available as a restricted one-time post-purchase offer at \$99 for a qualifying front-end buyer.
- The \$99 OCU is a price path for the same Upstream Course access. It is NOT a third course or duplicate product.
- The \$499 offer must be called Upstream Navigator. Do not call it “Complete System,” because that label belongs to a different historic Interconnected concept.

WORKING MODE AND SAFETY
1. Build all new sales pages as preview/draft pages first.
2. Create all Kajabi Products, Offers, and Upsell records in DRAFT status only. Do not publish an offer, make a checkout link public, change an existing checkout, attach an upsell to a live offer, change a price, alter email/SMS, change an automation, modify Shopify, alter a pixel, move traffic, or make a DNS/domain change without a separate, explicit approval.
3. Before writing final copy or creating products, audit the existing Upstream Course and Navigator assets. Reuse an existing product if it is the correct product. Do not duplicate products because of a price difference.
4. Do not invent curriculum elements, bonuses, coaching, community, consultation, testing, outcomes, guarantees, scarcity, reviews, testimonials, or health claims. If a factual inclusion is not verified, mark it `OWNER INPUT REQUIRED` and leave it out of public-facing copy.
5. Keep all health language educational. Do not claim diagnosis, treatment, cure, prevention, guaranteed outcomes, or that a test will find a root cause.

DELIVERABLE A — OFFER INVENTORY BEFORE BUILDING
Return a concise inventory table showing:
- existing Upstream products, offers, prices, access rules, and post-purchase settings;
- existing Navigator products, offers, prices, access rules, and post-purchase settings;
- the current Kajabi \$67 and \$99 Interconnected front-end offers, including exact offer IDs;
- whether a native Kajabi upsell can be attached to each proposed source offer;
- all missing facts that prevent accurate public copy.

Do not make a live change during this audit.

DELIVERABLE B — DRAFT KAJABI CATALOG
After the inventory is reviewed, create the following records in DRAFT only. Record every final product ID, offer ID, and preview checkout URL in an offer registry.

1. PRODUCT: `[DRAFT] Upstream Course`
   - Create this only if a suitable existing Upstream Course product does not already exist.
   - Add only confirmed modules, lessons, downloads, and access settings.
   - Use a course-specific thumbnail and description only after the content inventory is confirmed.

2. OFFER: `[DRAFT] Upstream Course — Standard — \$199`
   - Attach the Upstream Course product.
   - One-time payment: \$199 USD.
   - Keep the Offer in Draft.
   - Configure a review-only post-purchase destination: buyer library or approved draft thank-you page.
   - Do not activate additional marketing automations.

3. OFFER: `[DRAFT] Upstream Course — Qualified Buyer OCU — \$99`
   - Attach the SAME Upstream Course product. Do not create a separate \$99 course product.
   - One-time payment: \$99 USD.
   - Keep the Offer in Draft.
   - Create a separate reusable Kajabi Upsell page with OCU-specific copy. Because upsell pages can be reused across offers, do not reuse a page whose copy is meant for another source funnel.
   - Do NOT attach it to any live front-end offer until I explicitly name the source offer(s) and approve the attachment.

4. NAVIGATOR ENTITLEMENT
   - First inspect the exact Navigator-specific delivery. If Navigator only changes price or marketing language, do not create a separate product merely to justify it.
   - If Navigator includes real, distinct deliverables, create `[DRAFT] Upstream Navigator Resources` as a separate product or use the correct existing product. Add only confirmed content/services.

5. OFFER: `[DRAFT] Upstream Navigator — \$499`
   - Attach Upstream Course plus the confirmed Navigator-specific product only when applicable.
   - One-time payment: \$499 USD.
   - Keep the Offer in Draft.
   - Do not imply the Navigator is medical care or make any unverified claim about outcomes, coaching, testing, or access.

6. OPTIONAL UPGRADE OFFERS
   - Do not create these until I approve a credit policy.
   - If I approve full credit for prior Course purchases, prepare—but do not publish—two upgrade offers: \$300 from the \$199 Course and \$400 from the \$99 OCU Course.

DELIVERABLE C — PREVIEW-ONLY SALES PAGES
Create three draft/preview pages, using the existing Urban Monk visual system and keeping all checkout CTAs disabled or linked only to clearly marked preview placeholders until I approve exact destinations.

PAGE 1: `Upstream Course — \$199`
- Explain the core framework in plain language.
- Include: who it is for, what the learner receives, how the curriculum is organized, access expectations, and clear educational boundaries.
- Include a comparison block that makes the Course self-contained and shows how Navigator differs only through verified Navigator-specific inclusions.
- Primary CTA: `Start Upstream`.

PAGE 2: `Upstream Navigator — \$499`
- Explain the Navigator as the premium option after the Course has been introduced.
- Present a transparent Course vs. Navigator comparison.
- List Navigator-only inclusions only when verified.
- Primary CTA: `Choose Upstream Navigator`.

PAGE 3: `Upstream Course OCU — \$99`
- This is a short post-purchase page, not a long sales page.
- Headline direction: the buyer has just taken a meaningful first step and can add the deeper self-guided Upstream framework now.
- Show the normal \$199 price and the restricted post-purchase \$99 price only if the price policy is approved.
- List only confirmed Course inclusions.
- Acceptance CTA: `Yes, add Upstream for \$99`.
- Decline CTA: `No thanks, continue to my access`.
- No fake countdown, invented urgency, unrelated upsells, or unsupported health claims.

DESIGN REQUIREMENTS
- Use the existing Urban Monk aesthetic: calm dark blue-green context areas, warm white reading canvas, clear teal CTA buttons, large type, high contrast, and excellent mobile spacing.
- Keep the Course and Navigator comparison above the fold on desktop where practical, and easy to scan on mobile.
- Treat the \$99 page as a focused one-decision page.
- Use a single named CTA-destination registry. Do not scatter or invent checkout URLs.

FUNNEL AND ENTITLEMENT RULES
- The \$99 OCU may be configured only on Kajabi source offers in the first release, because Kajabi automatically grants access to the attached product after the customer buys its Offer.
- Do not offer the \$99 Kajabi Course OCU from Shopify/Zipify until a separately approved and tested Shopify-to-Kajabi paid-order entitlement bridge exists.
- If later asked to add the \$99 OCU to Shopify, first provide an implementation design covering idempotent payment handling, email/customer matching, Kajabi access granting, refund/revocation, failure recovery, access email ownership, and a safe test plan. Do not build or activate it without approval.
- Keep the current Interconnected \$67/\$99 price test separate from this new offer architecture. Do not change multiple pricing, checkout, routing, and messaging variables at once.

MEASUREMENT REQUIREMENTS
- Create an internal offer registry documenting product IDs, offer IDs, exact draft checkout URLs, source funnel, price, entitlements, upsell relationship, and post-purchase destination.
- Keep \$199 Course, \$99 OCU Course, \$499 Navigator, and future upgrades as separate conversion and revenue paths.
- Preserve Kajabi as the financial authority for Kajabi payments. Do not create duplicate purchase events or revenue records.

REQUIRED REVIEW BEFORE ANY PUBLICATION
Before asking me to publish or attach anything, provide:
1. the product/offer/upsell registry with IDs and preview links;
2. a confirmed inclusion matrix for Course versus Navigator;
3. the three preview-page URLs and desktop/mobile screenshots;
4. the exact proposed source offer(s) for the \$99 OCU;
5. all unresolved facts and destination placeholders;
6. a test plan that uses no real charge unless I explicitly approve it; and
7. a rollback plan.

Stop after the draft build and review. Do not publish, attach the OCU to a live offer, send email, change the front-end funnel, or make any live traffic change.
```

## References

[1]: https://help.kajabi.com/articles/sales/offers/create-an-offer "Kajabi Help Center — Create an Offer"
[2]: https://help.kajabi.com/articles/sales/offers/manage-upsells-in-the-purchase-flow "Kajabi Help Center — Manage Upsells in the Purchase Flow"
[3]: https://help.kajabi.com/articles/sales/offers/what-happens-when-a-customer-purchases-my-offer "Kajabi Help Center — Customer Offer Purchase Experience"
[4]: https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided "The Urban Monk Academy — Interconnected Series Self Guided"
[5]: https://shop.theurbanmonk.com/products/gut-permeability-test-health-coach-call-199-member-offer "The Urban Monk — Gut Permeability Test and 1-Hour Health Coach Call"
