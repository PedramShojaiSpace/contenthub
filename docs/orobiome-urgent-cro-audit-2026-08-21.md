# Orobiome Natalie Jill Page — Urgent CRO Audit

## Executive Finding

The page is visually distinctive, readable, and technically faster on mobile than the original. It is not yet optimized for **cold Instagram traffic** because it asks a visitor to process a complex medical-adjacent narrative before it makes the offer, exact package, price, and next step unmistakable. The live first-party partner signal is encouraging but too small to declare the page healthy or broken: Natalie Jill’s BixGrow profile showed **18 clicks, 1 order, and $399 in attributed sales** at the time of review—approximately **5.6% click-to-order** on a one-order sample.[1]

> **Implementation status:** This is a diagnostic and recommendation document. No CRO change in this document has been implemented.

## What Is Working

The route is fast for the intended mobile acquisition context, provides a clear Natalie Jill community context, preserves the BixGrow affiliate parameter through native Shopify cart CTAs, and has a human-facing clinical-review story rather than an automated-report-only offer. The three customer CTAs consistently point to the same partner offer, while the $399 package, free U.S. shipping, kit, specialist review, and one-on-one results presentation are all present on the page.[2]

## Main Conversion Frictions

| Priority | Live friction | Why it likely matters for cold traffic | Evidence / observation |
|---|---|---|---|
| **P0** | The first CTA says “Claim Your Exclusive Community Offer,” but the hero does not show the **$399 price** or plainly name the package. | Visitors must scroll and infer what they are claiming before deciding whether to click. | Price and package details appear materially later than the first CTA.[2] |
| **P0** | The headline leads with a high-certainty, provocative claim: “You Have No Idea What’s Going On In Your Health If You Can’t Test Your Mouth.” | It may create curiosity, but it can also trigger skepticism or defensiveness before value, process, and credibility are established. | Current hero copy.[2] |
| **P0** | The first narrative passage is long and symptom-heavy before operational reassurance appears. | Instagram visitors need a rapid answer to “What is this, what do I get, how much is it, and what happens next?” | Hero and early body flow.[2] |
| **P1** | The first visual trust evidence is partner affiliation, not a concrete explanation of laboratory process, privacy, result timing, or who conducts the review. | Medical-adjacent testing requires trust architecture before purchase intent can convert. | Practical details are delayed lower on the page.[2] |
| **P1** | The science sections are comprehensive but precede the offer and can read like a long-form educational article. | More education may be valuable after intent exists; before intent, it can delay the buying decision. | Current scroll sequence.[2] |
| **P1** | The current value stack shows $700 crossed out and $399 special price, but it does not offer an early, compact “what is included” summary beside the first decision point. | A cold visitor must assemble value from multiple sections. | Current offer module location and composition.[2] |
| **P2** | Partner attribution is functioning, but page-specific funnel instrumentation is insufficient. | We cannot distinguish bounce, low CTA click-through, cart abandonment, or checkout failure using the current store-level overview. | BixGrow exposes clicks/orders; the initial Shopify dashboard did not expose a page-specific funnel.[1] |

## Recommended Conversion Architecture

### P0 — First Screen Offer Clarity Test

This is the highest-priority experiment. Replace the first-screen decision unit with a simple hierarchy: **who it is for**, **what it is**, **what is included**, **the partner price**, and **one exact next action**. Preserve the current native Shopify destination and BixGrow parameter.

**Proposed test control:** Keep the current hero unchanged.

**Proposed test treatment:**

> **Oral Microbiome Test + Specialist Review for Natalie Jill’s Community**
>
> A simple at-home saliva test to map oral bacterial patterns, followed by specialist review and a one-on-one results presentation.
>
> **$399 partner price** · Kit + prepaid U.S. return shipping + specialist case review + live results presentation
>
> **Get the $399 Community Package →**

This is a conversion hypothesis, not a clinical promise. It gives a visitor an answer to the four immediate purchase questions without forcing a long scroll.[2]

### P0 — Hero Claim Risk Reduction Test

The page should test whether a less accusatory, more diagnostic headline improves confidence while retaining curiosity. A safer alternative is:

> **Could Your Oral Microbiome Be Part of the Health Picture You Have Not Seen Yet?**

This preserves the upstream thesis, avoids declaring that the visitor’s health understanding is absent, and fits a medical-adjacent education context. The test should keep the same offer, price, and CTA destination.

### P1 — Move Operational Trust Above the First Long Scroll

Place a concise three-item assurance bar directly below the first CTA:

| Visitor question | Confirmed answer to show |
|---|---|
| What arrives? | At-home oral microbiome kit |
| What happens after I send it? | DNA sequencing plus specialist case review |
| Will someone explain it? | Live one-on-one results presentation |

Add the confirmed 2–3 week timing and free U.S. shipping in the same immediate decision area. Do not add lab certifications, clinical claims, testimonials, reviews, or outcome statistics unless they are factual, permissioned, and verifiable.[2]

### P1 — Compress Education Before the First Price Exposure

Retain the educational content, but move a short “why it matters” summary above the first offer, then place detailed science below the first pricing module. The long article format is useful for people who need proof; it should not be the only route to seeing the package and price.

### P1 — Improve the Package Module, Not the Discount Claim

The page currently shows a multi-line value stack. Test a compact inclusion-led framing before the crossed-out total:

> **Your $399 package includes:** Kit · prepaid return shipping · DNA sequencing report · specialist case review · live results presentation.

Keep the current price and discount only if the component values are confirmed. Do not create new urgency counters, availability claims, or refund promises.

### P2 — Instrument Before Scaling Conclusions

The immediate measurement gap is not more platform-level traffic data. It is an actionable page funnel: page view, 25/50/75% scroll, first CTA click, second CTA click, add-to-cart, checkout started, and purchase. Each event should retain `bg_ref=109Nl4h0Ds` and any inbound UTM/click ID so Natalie’s traffic can be evaluated against actual click-through and purchase behavior.

## Recommended Test Order

1. **Hero offer clarity** — price, exact package, and CTA label in one first-screen treatment.
2. **Hero claim tone** — current provocative headline versus diagnostic-question alternative.
3. **Trust/operations bar** — kit, review, presentation, timing, and shipping in the first decision block.
4. **Education order** — short summary before the first offer, long science after it.
5. **Package framing** — inclusion-led value summary before the current discount stack.

Only one structural proposition should change per test. Use the same partner URL and native Shopify cart path in control and treatment. Evaluate with partner-attributed purchases and page-funnel events, not platform-reported proxy conversions alone.

## Pricing Governance Flag

The live page sells at **$399**. Existing project strategy material references a cold-audience oral-test position at **$299**, which conflicts with the live page. This is not a recommendation to change price now. It is a governance item: establish one approved campaign price and package definition before any price test, because an ungoverned price change would confound the page-learning process.

## Do Not Do

Do not fabricate reviews, ratings, customer testimonials, clinician endorsements, scarcity, test outcomes, or refund guarantees. Do not turn oral-microbiome education into a diagnosis or disease claim. Do not change price, package components, native checkout path, affiliate attribution, or checkout policy without a separately approved test plan.

## Decision Request

The fastest defensible next move is a **P0 hero-offer-clarity split test**. Before implementation, approve the desired experiment IDs:

| ID | Experiment |
|---|---|
| **A** | First-screen package + $399 + exact CTA clarity test |
| **B** | Hero claim-tone test |
| **C** | Early operational-trust bar |
| **D** | Education/offer sequence test |
| **E** | Page-funnel instrumentation plan |

## References

[1]: BixGrow Affiliate, Natalie Jill Hollan — authenticated profile, reviewed Aug. 21, 2026. First-party values at review: 18 clicks, 1 order, $399 sales.

[2]: [Live Natalie Jill Orobiome customer route](https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds)

[3]: [Baymard Institute — Product Page UX Research](https://baymard.com/research/product-page)

[4]: [Baymard Institute — Checkout Usability Research](https://baymard.com/research/checkout-usability)

[5]: [Landing Page Text Readability and Conversion Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8621191/)

[6]: [Persuasive E-commerce Landing Page Components](https://pubs.aip.org/aip/acp/article-abstract/2706/1/020057/2889308)
