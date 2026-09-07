# Framer-First Landing-Page Operating Model

**Prepared for:** The Urban Monk  
**Prepared:** September 6, 2026  
**Decision context:** The Urban Monk needs a fast, reliable way to create, organize, test, and host multiple campaign landing pages without depending on the Content Hub as the public landing-page host.  
**Scope:** Architecture and operating model only. No Framer account, project, API key, hosting, domain, page, experiment, form, checkout, tracking script, webhook, or traffic route was created or changed.

## The right operating model

The opportunity is not simply to “put pages in Framer.” The opportunity is to create a **single landing-page operating system** where Framer is the designer-friendly, high-performance public presentation layer and the Content Hub is the private control plane that keeps marketing fast without losing commercial, regulatory, SEO, attribution, or consent discipline.

> **Framer should host and present the pages. The Content Hub should govern the brief, assets, approved claims, tracking schema, experiment register, release checklist, and results. Kajabi and Shopify should remain the only checkout and transaction ledgers.**

This approach uses Framer for what it is strong at: rapid visual construction, page/CMS management, staging and branches, deployment, page-level SEO, fast hosting, and same-day on-page experimentation. Framer’s Server API can interact with a project’s CMS, canvas, branches, custom code, redirects, and publication workflow. [1] [2] The Content Hub remains valuable where Framer should not be asked to be authoritative: source-of-truth experiment records, exact-offer attribution, consent-safe integrations, and revenue reconciliation.

## Recommended target architecture

| Layer | System | Primary responsibility | Explicitly not responsible for |
|---|---|---|---|
| **Campaign presentation and hosting** | **Framer** | Public landing pages, reusable visual components, responsive design, page variants, CMS-backed campaign resources, staging previews, production delivery, page SEO. | Revenue truth, eligibility logic, consent authority, unrestricted data sync, autonomous publishing. |
| **Marketing control plane** | **Content Hub** | Page briefs, claim/source review, version registry, approved assets, CTA destination allowlist, UTM/arm schema, experiment registry, QA status, first-party revenue reporting. | Serving campaign pages to the public, direct checkout, automatic production publishing. |
| **Kajabi conversion ledger** | **Kajabi** | Agora entry offer, exact Offer IDs, cleared transaction and refund evidence, $199 upsell linkage, existing learning and email paths. | Managing multi-page creative production or declaring Meta ROAS as revenue. |
| **Shopify conversion ledger** | **Shopify** | Product checkout, supplements/tests, affiliate-aware carts, order and refund evidence. | Owning the Kajabi price-test revenue decision. |
| **Lifecycle messaging** | **Klaviyo / Sendy / Kajabi** | Approved email/SMS messaging after appropriate consent and source routing. | Injecting uncontrolled content or treating a phone number as SMS consent. |
| **Delivery diagnostics** | **Meta / Framer analytics** | Spend, reach, clicks, page engagement, and upstream conversion diagnostics. | Revenue source of truth for Agora. |

### Domain and project pattern

Use a **dedicated Framer Growth workspace** with one initial production project for campaign landing pages and one protected staging/branch workflow. The campaign host should sit on a clearly named separate subdomain, such as `go.theurbanmonk.com`, `try.theurbanmonk.com`, or `offers.theurbanmonk.com`—subject to owner selection and DNS availability. Do not place the campaign host on `content.theurbanmonk.com`, which has a separate Content Hub role and prior operational dependencies.

Inside Framer, organize pages by URL path and campaign identity rather than creating a new project for every test. A single project offers shared typography, components, design tokens, tracking conventions, and release process. Create a new project only when a campaign requires distinct collaborators, a materially different security boundary, or a risk that a shared release could affect unrelated high-traffic pages.

| Framer organization | Use it for | Avoid it for |
|---|---|---|
| **Shared component library** | Headers, footers, legal modules, CTA patterns, form blocks, proof modules that are actually substantiated, mobile layouts, accessibility patterns. | Customer-review components without verified source and permission records. |
| **Campaign template** | Hero, problem framing, education, proof/reference slot, offer transition, FAQ, CTA, legal/disclosure slots, thank-you variant. | Hard-wiring one product, checkout, price, or audience into the template. |
| **Campaign page** | A concrete offer, source, audience, page owner, approved asset set, SEO posture, CTA destination, and status. | A silent replacement for another campaign’s live route. |
| **Branch / staging preview** | AI-created or human-edited work awaiting visual and compliance review. | Live paid traffic or irreversible public sharing. |
| **Production release** | Owner-approved page/version with recorded destination and tracking configuration. | Automatic promotion after AI generation, CMS sync, or a form event. |

## The AI-assisted creation workflow

The business goal is speed, but speed should come from **templates and approvals**, not from uncontrolled publishing.

### Step 1: Capture a structured campaign brief in the Content Hub

Each requested page should be created from a structured brief rather than a blank chat prompt. The brief should contain the campaign name, audience, offer, funnel source, desired page action, approved message hierarchy, substantiated claims/reference set, mandatory disclosure language, approved images/video, SEO posture, canonical destination, and checkout platform.

The brief must also name an owner, an intended domain/path, an experiment status, and the exact query-string contract. Example campaign metadata:

| Field | Example |
|---|---|
| Campaign ID | `agora-p1-entry-price` |
| Audience | Meta-acquired Interconnected screening registrants |
| Page role | Thank-you conversion page |
| Checkout system | Kajabi |
| Offer arm | `p49`, `p67`, or `p99` |
| UTM / arm key | `utm_campaign=agora-p1&utm_content=p49` |
| SEO posture | `noindex`, canonical to control during paid test |
| CTA allowlist | Exact approved Kajabi checkout URL only |
| State | Draft / Preview / Approved / Live / Archived |

### Step 2: Generate a Framer-ready page payload

AI should generate a **Framer-ready content and design payload** from the approved brief: section copy, type hierarchy, image placements, alt text, CTA labels, FAQ content, SEO title/description, and analytics event names. It should not generate medical guarantees, invented studies, unapproved testimonial claims, arbitrary discounts, or arbitrary checkout links.

The Content Hub’s role is to compare the payload to the approved brief and enforce the guardrails before it is placed in Framer. The recommended first iteration is human-reviewed payload generation, not direct production modification.

### Step 3: Build to a Framer branch or staging preview

Framer supports branches and deployment inspection through its developer APIs. [2] The implementation should create or update a staging branch/page and return a preview URL for human review. The content team can assess visual quality, mobile layout, copy accuracy, claim support, page speed, CTA links, and SEO settings without affecting the production page.

The Server API is powerful enough to update canvas/CMS content, publish, deploy, and manage redirects. [1] [2] For that reason, it should never be connected to an unrestricted “generate and publish” action. The production action must remain unavailable until a named approver accepts the checklist.

### Step 4: Register the approved release and launch deliberately

Before a Framer page receives paid traffic, the Content Hub must record the final published URL, canonical URL, designated checkout URL, pixel/tag status, UTM/arm schema, associated offer ID, experiment identity, and release owner. The outgoing CTA must be allowlisted and checked before release.

This keeps the Framer presentation layer flexible while preventing a live page from silently sending visitors to the wrong Kajabi offer, the wrong Shopify product, or a test arm with incomplete attribution.

## SEO operating model

Framer offers native controls for titles, descriptions, CMS SEO fields, slugs, canonical tags, redirects, robots handling, sitemap generation, structured data, and social previews. [3] It is therefore suitable for both campaign pages and future controlled SEO resource pages.

The critical requirement is **different SEO treatment by page type**:

| Page type | Recommended SEO posture | Reason |
|---|---|---|
| Paid campaign page | `noindex`; canonical to the stable control or primary campaign page | Avoid duplicate pages and accidental organic exposure while tests run. |
| A/B or price-treatment page | `noindex`; canonical to the non-test control | Prevent price-variant URLs from competing in search or being indexed as separate offers. |
| Evergreen education/resource page | Indexable only after content, sourcing, medical/legal review, internal linking, and canonical decision | Build a durable organic asset deliberately. |
| Migrated WordPress topic | Do not duplicate by default; use a migration/redirect/canonical plan | Preserve existing equity and avoid duplicate-content ambiguity. |

Framer redirects can be managed through site settings and developer APIs. [2] They should be used only after an approved old-to-new URL map exists. An AI-generated page should not create a redirect on its own.

## Experimentation and attribution model

Framer Convert includes native A/B tests, funnels, custom events, and triggers; the Convert add-on is available on Pro or Enterprise plans and supports up to five A/B tests. [4] [5] Framer custom tracking IDs can provide immediate page-action events for a CTA, form, or engagement milestone. [6]

That capability is valuable—but it must be used for the right question. Framer’s native assignment is a privacy-oriented, cookie-free daily identifier and counts conversions within the same day. [4] It should therefore be the primary reporting tool only for **same-session or same-day on-page actions**, not for a 14-day cleared-revenue decision.

| Question | Best measurement system | Primary metric | What stays fixed |
|---|---|---|---|
| Which headline or hero composition gets more qualified CTA clicks? | Framer Convert | CTA event rate per Framer visitor | Offer, price, checkout, funnel source. |
| Which form layout gets more completed submissions? | Framer Convert plus signed Content Hub form receipt | Verified submit rate | Offer, pricing, consent wording, routing. |
| Is $49, $67, or $99 economically superior? | Content Hub price-test tracker plus Kajabi exact Offer transactions | Cleared/refund-adjusted Kajabi revenue per assigned entrant after 14 days | Kajabi checkout, page structure, messages, $199 parity, targeting. |
| Does a consent-safe Shopify/Klaviyo lifecycle path work? | Shopify + Content Hub + Klaviyo path record | Separate Shopify funnel economics and verified consent state | Price, checkout system, email sequence; SMS only among prior explicit opt-ins. |

For any Framer-to-checkout CTA, preserve an explicit routing contract: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, a campaign/page ID, and the arm label. The Content Hub should persist entrant assignment before the external checkout, and Kajabi/Shopify should provide the later transaction record. Framer analytics and Meta are diagnostic layers, not replacement revenue ledgers.

## Forms, privacy, and consent

Framer forms can deliver JSON submissions to an HTTPS webhook and can sign requests using a configured secret. Framer states that a receiver should validate the signature and submission ID and return a direct 2xx response; otherwise Framer may retry delivery. [7]

If forms are used, the Content Hub should receive the data through one narrowly scoped endpoint that verifies the signature, rejects replays, applies a field allowlist, logs only necessary metadata, and sends no subscriber message itself. Email consent and optional SMS consent must be separate fields. A telephone number must never be treated as SMS consent.

Do not use a form webhook or Framer’s Server API as a general-purpose inbound automation channel. In particular, no webhook should be able to publish a page, change a checkout destination, create a Klaviyo enrollment, or activate an experiment.

## Security and release governance

| Control | Required standard |
|---|---|
| Framer API key | Dedicated to a single Urban Monk Framer project/workspace; stored only in secure server configuration; never browser-side, chat-visible, committed, or logged. |
| Permission boundary | Separate content-editor and deployment-approver roles. The AI/content workflow can build draft/preview material; a named human owns production deployment. |
| Branch policy | All generated or imported changes begin on a branch or staging preview. |
| Publish policy | No automated production publish, domain deployment, redirect, or experiment start. Each requires explicit approval. |
| CTA safety | Only allowlisted Kajabi/Shopify/approved destinations. Block arbitrary external destination URLs. |
| Claim safety | The generator may use approved source material and language only; no invented research, outcomes, customer reviews, ratings, guarantees, or diagnostic claims. |
| Tracking safety | One tracking map per page; avoid double-loading pixels or mixing destination-specific pixel events. Kajabi revenue remains the source of truth for Agora. |
| Incident response | Ability to disable Content Hub → Framer outbound calls immediately, rotate the project key provider-side, and roll back the Framer release from a known deployment. |

## Phased implementation options

| Approach | What it delivers | Tradeoffs | Cost / plan implication | Setup complexity |
|---|---|---|---:|---:|
| **A. Recommended: Framer Growth system + Content Hub control plane** | A dedicated Framer campaign project, reusable template, staging workflow, Content Hub page registry/brief, approved CTA map, and later API-assisted draft generation. | Maintains two systems, but each has a clear job. Preserves existing Kajabi/Shopify evidence and reduces hosting/release risk. | Framer Pro is listed at $30/month; Convert is listed at $50 per 500,000 events, subject to Framer billing changes. [5] | Moderate |
| **B. Framer designer workspace first** | Framer templates and hosting, with human/manual page builds and a documented UTM/SEO checklist. | Gets speed immediately with least integration risk, but leaves more handoff work and fewer controls until phase two. | Framer plan only. | Low |
| **C. Full API automation from the start** | Content Hub can create/update Framer drafts, manage a campaign CMS, and prepare previews from approved briefs. | Highest speed after build-out, but needs strict credential isolation, detailed approval gates, error handling, and audit history. | Framer plan plus build effort. | High |

**Recommended adoption path:** Start with **Approach B for one pilot page**, then add the Control Hub registry and preview workflow in Approach A. Only add direct Server API draft generation after the team proves that the page template, tracking standard, and release checklist are stable.

## 30-day pilot plan

| Stage | Purpose | Deliverable | Must not happen yet |
|---|---|---|---|
| **1. Foundation** | Establish safe Framer ownership and a reusable template. | Dedicated Framer Growth project, component rules, campaign naming convention, staging/branch rules. | No production domain, live paid traffic, CMS migration, or API key integration. |
| **2. One safe build** | Prove speed and visual quality. | One non-indexed campaign page in staging, using only approved copy/assets and a placeholder CTA. | No checkout connection or data collection. |
| **3. Measurement integration** | Prove the outgoing CTA and attribution contract. | One approved checkout handoff with source/arm parameters and Content Hub page registry record. | No cross-platform revenue pooling or automatic launch. |
| **4. Low-risk controlled launch** | Validate production release and monitoring. | One owner-approved, non-price experimental page or paid campaign page, using Framer engagement data plus the appropriate checkout ledger. | No native Framer test as the only authority for price economics. |
| **5. Draft automation** | Increase throughput without sacrificing control. | Content Hub produces Framer draft/preview payloads via a project-bound API key, with human publish approval. | No autonomous publishing or direct customer-data sync. |

## Decision and next approval

The immediate decision is whether to adopt Framer as **the campaign host for all new landing pages**, beginning with one isolated pilot. If selected, the next work should not be “turn on an API.” It should be a small foundation package: choose the Framer workspace owner and project plan, choose the dedicated campaign subdomain, establish the template and release roles, and build a non-indexed staging page.

Only after that foundation is approved should we connect the Content Hub to Framer’s Server API for **draft/preview creation**. Publishing to production, connecting a custom domain, placing a checkout URL, installing a pixel/tag manager, adding a form webhook, beginning an A/B test, or routing paid traffic should each remain separate owner-approved actions.

## References

[1]: https://www.framer.com/updates/server-api "Framer Server API announcement"  
[2]: https://www.framer.com/developers/reference "Framer developer API reference"  
[3]: https://www.framer.com/help/articles/guide-to-seo-features-and-tools/ "Framer SEO features and tools"  
[4]: https://www.framer.com/help/articles/how-to-run-an-a-b-test-on-your-framer-site/ "Run an A/B test on a Framer site"  
[5]: https://www.framer.com/pricing "Framer pricing and Convert add-on"  
[6]: https://www.framer.com/help/articles/how-to-track-custom-events-in-framer/ "Track custom events in Framer"  
[7]: https://www.framer.com/help/articles/framer-form-webhook-setup/ "Connect Framer forms to a webhook"
