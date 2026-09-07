# Dedicated Interconnected Subdomain — Blueprint and New-Thread Brief

**Status:** Planning only.  
**Proposed public host:** `interconnected.theurbanmonk.com`  
**Objective:** Preserve the Interconnected video-and-education experience while replacing Kajabi’s difficult page-editing surface with a dedicated, modular public page system that supports rapid, controlled CRO iteration.

## Executive recommendation

Yes—this is a sensible next step. The most practical version is **a dedicated public marketing project**, separate from the authenticated Content Hub and separate from Kajabi. It should use a lightweight static React site, with a shared episode design system and a small content configuration layer. This gives the team a stable location to make precise page, CTA, hierarchy, and experiment changes without touching Kajabi’s editor or interfering with the Content Hub.

The hosted video does **not** need to be moved. Each new episode page can use the existing Wistia embed, retaining the same hosted video delivery while allowing every surrounding conversion element—the post-video bridge, offer selection, CTA language, FAQs, proof, and mobile layout—to be updated directly in the dedicated project.

> The right first release is **Episode 5 as an improved pilot**, not a rushed ten-page migration. Once the pilot is approved, the same reusable episode system can power the remaining series pages quickly and consistently.

## What the public experience would look like

| Layer | Role on `interconnected.theurbanmonk.com` | Why it matters |
|---|---|---|
| Series hub | Presents the Interconnected premise, episode roadmap, and where to start. | Creates one coherent public home rather than a disconnected set of Kajabi pages. |
| Individual episode pages | Routes such as `/episode/5` host the embedded Wistia video, short episode context, takeaways, read-along guide, and a focused next-step decision block. | Each email can drive to a consistent page model while content and CRO improve centrally. |
| Offer-choice module | Presents Test, Course, and Complete System paths using clear “best for” language, verified inclusions, and one CTA per option. | Lets visitors self-select quickly instead of parsing dense, repeated sales copy. |
| Trust / FAQ / disclosure layer | Holds real expert endorsements that are authorized for use, factual guarantee terms, FAQs, educational disclaimer, and support paths. | Improves decision confidence without fabricating reviews or making unsupported claims. |
| Whitelisted handoff routes | A small first-party redirect endpoint sends each CTA only to an approved Shopify product URL while forwarding relevant UTM/Klaviyo query parameters. | Protects attribution and prevents accidental routing changes. |
| CRO control layer | Centralizes design tokens, CTA labels, transition copy, offer cards, and approved experiment variants in code/config. | Makes changes fast, reviewable, reversible, and consistent across all episodes. |

## The Episode 5 pilot structure

The new page should preserve the best parts of the current Episode 5 experience while removing the Kajabi-era friction. The recommended order is:

1. **Episode hero:** Series identity, “Episode 5,” a concise topic line, and the embedded Wistia video. The visitor’s first job is to watch.
2. **Episode takeaway block:** Three to five scan-friendly learning points, followed by the existing read-along guide as an optional micro-conversion.
3. **Post-video decision bridge:** A short, clinically qualified explanation of what a visitor can do next after the episode, with one “Choose Your Next Step” anchor button.
4. **Three-path offer chooser:** Test, Course, and Complete System—with one-line “best for” selectors above their detailed inclusions. The bundle should make the separate-price comparison and exact consultation entitlement unambiguous.
5. **Credibility + FAQ:** Authorized experts, factual FAQs, guarantee terms with a direct link, and the required medical/educational disclaimer.
6. **Low-friction footer:** Contact, privacy, terms, and optional sharing after—not before—the commercial decision.

This preserves the series as an experience rather than turning it into an aggressive landing page. It simply makes the next step clearer at the moment of highest intent.

## Build model: editable without Kajabi

The dedicated project should be organized around reusable components rather than duplicating a long page for every episode.

| Reusable element | Controlled fields | Benefit |
|---|---|---|
| `EpisodeHero` | Episode number, title, Wistia media ID, poster image, series subtitle. | Maintains consistent video presentation. |
| `EpisodeTakeaways` | 3–5 benefit-led, clinically qualified takeaways and guide link. | Makes the teaching content easy to refine. |
| `NextStepBridge` | Short transition copy, anchor label, optional secondary guide CTA. | Enables fast CRO improvements without rebuilding the page. |
| `OfferChooser` | Offer names, “best for” label, factual inclusions, displayed price, approved destination key, CTA label, recommendation indicator. | Keeps offer comparisons consistent and avoids destination mistakes. |
| `TrustLayer` | Authorized endorsements, named sources, FAQ answers, guarantee terms URL, disclaimer. | Prevents unverified proof or claims from being copied into new pages. |
| `SiteTheme` | Interconnected dark blue-green, white canvas, cyan-teal CTA, typography, spacing, breakpoints. | Lets brand, accessibility, and responsive improvements apply everywhere. |

In practical terms, an ordinary content/design adjustment becomes a small, reviewable change to one component or one structured content file instead of a manual Kajabi block-editing session. The public project remains simple—no user accounts, course enrollment, CRM, or checkout logic should be recreated there.

## Video, checkout, and attribution boundaries

| Capability | Proposed implementation | Deliberately not rebuilt |
|---|---|---|
| Episode video | Reuse authorized Wistia embeds. Load the player only where it appears and preserve responsive/aspect-ratio behavior. | Video file hosting, storage, or a new streaming platform. |
| Read-along guide | Use the approved existing guide destination or an approved dedicated download page. | New lead capture or email automation without an explicit decision. |
| Product CTA | Each offer uses a named destination key, not a hard-coded URL scattered through the page. | A new cart, payment form, Shopify product edit, or price change. |
| Attribution | Preserve incoming `utm_*`, `_kx`, and other approved click parameters through a first-party, allowlisted redirect to the matching Shopify product. | Unapproved pixels, cross-domain data sharing, or automatic audience enrollment. |
| Purchase reporting | Shopify remains the transaction ledger for these product pages; report page engagement separately from completed purchase records. | Treating page clicks or analytics-platform purchase estimates as revenue truth. |
| Email/SMS | Existing Klaviyo flow remains unchanged until a message-by-message routing plan is separately approved. | Automatic replacement of live Kajabi URLs in emails or any change to consent/list rules. |

## CRO operating model

The dedicated project makes controlled experimentation far easier, but it should not turn into uncontrolled design churn. The operating sequence should be: **brief → draft route → owner review → limited change → measurement window → decision → retained or rolled back.**

Good early tests are message and experience tests: the post-video bridge, “best for” offer labels, CTA labels, offer-card order, confirmation of guaranteed terms, or whether the offer decision block begins closer to the video. These can be tested without changing product price or checkout platform.

Price, checkout-provider, and SMS-route testing should remain separate from the existing Kajabi price-test plan. A visitor should not simultaneously receive a new price, new checkout stack, new email path, and new page hierarchy; that would make results uninterpretable.

## Release and domain sequence

| Stage | Work | Owner decision required? |
|---|---|---|
| 1. Dedicated project | Create a new public static project with no Content Hub authentication or database dependency. Build only `/episode/5` as the pilot. | Yes, before creating the new project. |
| 2. Private preview | Use the project’s preview URL to review mobile/desktop layout, Wistia embedding, CTA labels, destinations, performance, accessibility, claims, and disclosures. No custom domain or email changes. | Yes, to approve the pilot design/content. |
| 3. Domain connection | Add `interconnected.theurbanmonk.com` only after the preview is approved. At the DNS host, point the subdomain CNAME to the target shown in the new project’s Domains panel, then verify TLS and the public route. | Yes, before any DNS/domain action. |
| 4. Staged adoption | Add the new URL to one specifically approved future email or campaign, with defined UTM parameters. Keep the corresponding Kajabi page live as a rollback path. | Yes, message/campaign specific. |
| 5. Series rollout | Clone the approved Episode 5 system into the remaining episode routes and migrate only approved content/media. | Yes, after the pilot passes. |
| 6. Legacy decision | Maintain, redirect, or retire individual Kajabi pages only after traffic, SEO, tracking, and support implications are reviewed. | Yes, per path. |

The DNS cutover must not begin with a global redirect. A new public subdomain lets the team add the improved pages gradually and preserves the existing Kajabi links as a fallback. This is especially important because live flow email URLs should not be changed wholesale without reviewing each message’s purpose.

## Non-negotiable safeguards

The new project must remain a public experience—not a copy of the Content Hub. It should not require a Manus login, reuse the Content Hub root hostname, or share internal dashboard code. All external CTA destinations must be allowlisted and reviewable. No testimonials, reviews, ratings, or customer stories may be fabricated. Existing named expert endorsements may be reused only after confirming that the wording and use remain authorized.

All medical and health language should be reviewed for accuracy and scope before publication. The build should favor educational framing and avoid unsupported promises, diagnostic claims, or broad outcome guarantees. Existing Kajabi offers, Shopify products, prices, checkout settings, customer information, Klaviyo flows, consent rules, Meta delivery, and budgets remain outside the project’s scope.

## Recommended new-thread prompt

Copy the following into a new thread when you are ready to build it:

```text
Create a new, dedicated PUBLIC static web project for The Urban Monk’s Interconnected video series. This must be separate from the Content Hub and must not require Manus login/authentication. The intended future domain is interconnected.theurbanmonk.com, but do NOT connect the domain, change DNS, publish it publicly, redirect traffic, or alter any existing Kajabi/Klaviyo/Shopify behavior until I explicitly approve each external action.

Goal: Replace the hard-to-edit Kajabi episode-page presentation layer with a modular, high-performance, CRO-friendly public experience. Preserve the education-first feel and reuse the existing hosted Wistia video embed rather than moving/re-hosting video.

Build only an Episode 5 pilot first at /episode/5. The page should include:
1) Interconnected hero with episode title and responsive Wistia video embed;
2) three to five episode takeaways;
3) a “Download the Episode Read-Along Guide” micro-conversion;
4) a short post-video decision bridge with one anchor CTA: “Choose Your Next Step”;
5) a three-path offer chooser with these factual displayed offers and approved current product destinations:
   - Test: KBMO FIT22 + Gut Barrier Test Kit + the currently confirmed consultation entitlement; displayed $399; destination key test;
   - Course: Upstream Course; displayed $299; destination key course;
   - Complete System: the bundle; displayed $499; destination key bundle.
6) quick “best for” decision lines above detailed inclusions;
7) a recommended bundle explanation that clearly explains the verified separate-price comparison and does not double-count any consultation;
8) authorized expert endorsements only if wording/use is confirmed; otherwise use no testimonials;
9) FAQs, a link to exact promise/guarantee terms if approved, education/medical disclaimer, privacy, terms, and contact links.

Make every repeated section modular and use a structured content configuration so future episodes can be created by changing episode data, not duplicating a long page. Use an accessible, mobile-first Interconnected design system: dark blue-green imagery/header context, white reading canvas, cyan-teal CTAs, high readability, and no dark buttons that resemble black. Optimize images, defer nonessential scripts, preserve video responsiveness, and do not embed Elfsight social sharing above the offer decision.

Routing/measurement safeguards:
- Do not create or edit offers, products, checkouts, prices, customer data, Kajabi pages, Klaviyo emails/SMS, Meta settings, pixels, or budgets.
- Create a central named CTA-destination map; never scatter or invent checkout URLs.
- Do not activate any CTA until its exact destination is verified and approved.
- Design a first-party allowlisted redirect pattern that forwards approved utm_* and Klaviyo _kx click parameters to Shopify product pages. Keep it disabled/draft until destination review.
- Keep Shopify as the transaction ledger for product purchases and page engagement as a separate measurement stream.
- Do not turn this into a price test. Page/layout experiments must preserve product, price, checkout, and channel so results remain interpretable.

Required delivery before any domain/DNS or live-route action:
- an editable preview of /episode/5;
- a short page/copy inventory showing what was carried over, rewritten, or left out;
- verified draft CTA destination map;
- mobile and desktop visual checks;
- basic accessibility/performance review;
- a domain cutover and rollback checklist.

After the pilot is approved, prepare—not execute—a plan to add /episode/1 through /episode/10 and a series hub. Do not change live Kajabi links or the existing Klaviyo flow unless I approve a specific message-by-message routing map.
```

## Bottom line

Creating `interconnected.theurbanmonk.com` as a new, focused public project is the cleanest way to get the editing and CRO control you want. It lets you retain Wistia, retain Shopify checkout, retain your existing email flow for now, and materially improve the episode experience—all without having to wrestle with Kajabi’s page editor. The first move should be a single Episode 5 pilot on a preview URL; the DNS connection and any traffic migration should come only after that pilot has been reviewed and approved.

## References

[1] [Interconnected Episode 5 CRO Audit](./interconnected-episode-5-kajabi-cro-audit-2026-09-07.md)
[2] [Interconnected Episode 5 live Kajabi page](https://theacademy.theurbanmonk.com/episode-view-page-eg-ep-5-SP26)
