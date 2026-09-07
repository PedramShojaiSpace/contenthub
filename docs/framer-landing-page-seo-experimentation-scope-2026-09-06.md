# Framer Scope Report: Landing Pages, SEO, and Experimentation

**Prepared for:** The Urban Monk  
**Prepared:** September 6, 2026  
**Scope:** Read-only platform evaluation. No Framer connector, account, API key, site, CMS collection, custom domain, page, test, webhook, redirect, or publishing workflow was created or changed.

## Executive conclusion

Framer is a credible **campaign landing-page production layer** for The Urban Monk. Its Server API can programmatically connect to a specific Framer project, work with canvas and CMS content, inspect branches, and publish a preview or deploy a selected release. Framer also has first-party controls for page and CMS metadata, redirects, sitemap/robots output, structured data, analytics, and native A/B testing. [1] [2] [3]

However, Framer should **not replace the Content Hub as the acquisition source-of-truth or replace Kajabi/Shopify as the purchase ledger**. Its native A/B tests use a cookie-free anonymous identifier that resets daily and therefore only measure same-day outcomes. That makes Framer suitable for upstream page engagement—such as CTA clicks, opt-ins, or same-day thank-you-page views—but not sufficient on its own to decide a $49/$67/$99 test based on cleared Kajabi revenue and a 14-day refund/maturity window. [4]

The best fit is to use Framer for rapid, designed landing-page creation and lightweight page experiments, while retaining the Content Hub for experiment registration, first-party arm attribution, exact-offer mapping, QA gates, and decision reporting. Kajabi continues to own cleared Agora revenue and Shopify continues to own its separate checkout path.

## What Framer can support

| Requirement | Framer capability | Scope implication for The Urban Monk |
|---|---|---|
| Rapid landing-page production | Canvas APIs can create and manipulate page elements; the Server API can connect from a server to a named project. [1] [2] | A reusable Framer campaign template could be populated from a controlled brief, then visually reviewed before release. |
| CMS-based page families | The CMS API supports collections, fields, item reads/writes, item drafts, and managed collections. [5] | Good fit for repeatable campaign pages, resource hubs, or a controlled SEO content library. |
| Programmatic publish workflow | The Server API can identify changes, create a preview deployment, and promote a selected deployment. [1] [2] | Use preview/staging first; production promotion must remain explicitly owner-approved. |
| SEO operations | Framer supports titles, descriptions, CMS metadata, clean URLs, redirects, canonical tags, sitemaps, robots rules, structured data, image alt text, and analytics. [3] [6] | Strong fit for new campaign and SEO pages, but existing WordPress content should not be duplicated without canonical/noindex planning. |
| Native page experimentation | Framer Convert provides A/B tests, funnels, custom events, and triggers. Tests can have up to five variants and evenly distribute traffic. [4] [7] | Useful for high-traffic visual, headline, CTA, or form tests that resolve in a same-day action. |
| External analytics and Meta browser events | Meta Pixel and tag-manager code can be placed in the site settings; custom events can be tracked with Framer tracking IDs. [8] [9] | Feasible, but must be implemented from a written event map and never used as revenue authority. |
| Lead capture handoff | Forms can post JSON to an HTTPS webhook; Framer signs requests when a webhook secret is configured. [10] | Feasible for a future Content Hub lead endpoint, but signature verification, replay protection, consent fields, and a direct 2xx response are required. |

## Important limitations and design constraints

### 1. Native Framer A/B testing is not enough for the Kajabi price decision

Framer’s native experiment assignment uses a non-identifying daily browser/IP-based identifier rather than a durable cookie; conversions are limited to the same day. [4] That is a reasonable privacy-oriented design for a CTA-click or form-submission test. It is not a sufficient ledger for a paid conversion that may clear later, refund within a 14-day window, or include an independently mapped one-click upsell.

For the Agora price test, Framer could measure **top-of-funnel signal**—for example, unique visits, CTA starts, and opt-ins—but the decision must continue to be made in the Content Hub from the exact Kajabi Offer ID, deduplicated first-party entrant assignment, cleared base revenue, refunds, and separately mapped $199 upsell revenue. Meta’s browser event data remains delivery/diagnostic evidence only, not revenue evidence.

### 2. The API is powerful and must be isolated

The Server API uses a project-bound API key created in the Framer project settings and can update a project, publish, and deploy. [1] [2] That is materially more powerful than a content-feed token. Given the recent HeyGen incident, any future Framer credential should be limited to one dedicated campaign project, stored only in secure project configuration, and never surfaced in browser code, logs, chat, URL parameters, or source files.

Use an explicit three-state release model: **draft → preview → owner-approved production**. The Content Hub should never automatically promote a Framer deploy in response to an AI-generated page, a webhook, a CMS sync, or a scheduled job.

### 3. Do not create a second source of truth for checkout and consent

Framer should be the presentation layer. Kajabi and Shopify must remain the checkout and transaction systems. A Framer page’s only commercial responsibility is to carry an allowlisted destination URL and arm/source parameters to one designated checkout.

For leads, a Framer form can post to a Content Hub endpoint, but only after a dedicated consent design is approved. Framer’s own form documentation says the receiver should validate the configured signature and return a direct 2xx response; it also notes that unsuccessful destinations can be retried. [10] A future receiver should use the signature, a replay-safe submission ID, field allowlists, separate email versus optional SMS consent fields, and strict rate limits. Phone presence must never imply SMS consent.

### 4. Do not turn one test into many

In the near term, Framer should not be introduced into the existing Kajabi $49/$67/$99 test. Doing so would introduce a second page builder, a new analytics method, possibly new scripts, and a different checkout handoff at the same time as price. The existing Content Hub price-test tracker and controlled Kajabi path are the cleaner vehicle for that first commercial test.

## Recommended architecture options

| Approach | Tradeoffs | Cost / plan implication | Setup complexity |
|---|---|---:|---:|
| **A. Framer campaign layer + Content Hub measurement** | Framer owns rapid page design, CMS presentation, and optional upstream experiments; the Content Hub retains experiment registry, source/arm data, QA, and dashboard; Kajabi/Shopify retain checkout and revenue. This preserves clean attribution and supports gradual adoption. | Framer Pro is listed at $30/month; Convert is listed at $50 per 500,000 analytics events, subject to plan and billing changes. [11] | Moderate |
| **B. Framer-only campaign stack** | Fastest designer-led workflow, native analytics and A/B testing, fewer systems. But it is not adequate alone for the current 14-day cleared-Kajabi-revenue price test and would fragment existing reporting. | Same plan/add-on requirements; may reduce some internal page-maintenance effort but adds platform dependence. | Lower initial setup, higher measurement risk |
| **C. Retain the current Content Hub only** | No new platform or credential surface. The existing tracker and draft $49/$99 routes are already ready for the manual Kajabi offer mapping. It is slower for highly visual iterative LP work. | No Framer subscription. | Lowest |

## Suggested operating model if Approach A is selected

### Page lifecycle

1. A marketer creates or approves a campaign brief containing audience, offer, required substantiated claims, CTA, designated checkout platform, UTM/source schema, SEO status, and owner.
2. The Content Hub produces a **draft payload**, not a production publish instruction. It includes approved copy, media references, accessibility text, canonical/noindex instruction, and a fixed CTA destination placeholder.
3. Framer receives the draft into a dedicated campaign project or CMS collection. The build is visually reviewed in a branch or staging preview.
4. The Content Hub validates the outgoing checkout URL against an allowlist, confirms the tracking parameters, and records the exact page/version/arm relationship.
5. An owner approves a preview; only then may a person or an approval-gated release action deploy the selected version.
6. Once live, Framer reports upstream events; Kajabi or Shopify supplies the cleared commercial result; the Content Hub reconciles both without pooling them.

### SEO model

Framer is well suited to **net-new campaign pages** and controlled resource-page families. Each page should carry a deliberate title, meta description, H1, image alt text, social preview, canonical tag, and appropriate index directive. [3] [6]

Do not copy already-indexed WordPress blogs or existing sales pages into Framer. For price-test variants, use `noindex` and canonicalize to the control unless the testing plan deliberately calls for a separately indexable resource. Use redirects only after maintaining an old-to-new URL map and confirming the destination. Framer’s SEO settings do support redirects, but moving an established URL should remain an owner-approved migration action. [3] [6]

### Experiment model

Use two different analytical layers on purpose:

| Test question | Primary system | Primary decision metric | Rule |
|---|---|---|---|
| Does a headline, page layout, CTA, or form placement improve immediate engagement? | Framer Convert | Same-day tracked link click, form submit, or page view | Keep a common tracking ID and do not change checkout platform or price in the same test. |
| Does $49, $67, or $99 create more net revenue per eligible entrant? | Content Hub + Kajabi | Cleared exact-offer Kajabi revenue per assigned entrant after refund maturity | Keep Framer out of the first price test; retain the Content Hub’s sticky assignment and 14-day decision window. |
| Does an SMS-enhanced, consent-safe Shopify path improve a Shopify funnel? | Content Hub + Shopify + Klaviyo | Separate Shopify funnel economics and verified consent-state events | Test only among explicit SMS opt-ins; do not combine with a Kajabi price test. |

If a future Framer page needs to hand traffic to Kajabi, each treatment must include an explicit arm parameter in the outbound URL, such as `utm_source=meta&utm_medium=paid-social&utm_campaign=agora-p1&utm_content=framer-p49`. The Content Hub must retain the assignment at entry and reconcile the exact Offer ID later. Use a stable, lowercase Framer tracking ID for the immediate CTA event, such as `agora-checkout-start`; Framer requires tracking IDs to be lowercase and hyphen-separated. [9]

## Minimum viable pilot

The lowest-risk pilot is not a full migration. It is one **new, non-indexed campaign template** in a new Framer project with no paid traffic and no checkout until review. The pilot should include a control page, one cosmetic variant, an approved form or CTA placeholder, test tracking IDs, page-level SEO settings, and a staging review. It should confirm the following before a production page is considered:

| Pilot acceptance check | Required evidence |
|---|---|
| Draft / preview separation | Framer branch or staging preview URL has been reviewed; production is untouched. |
| CTA integrity | Every CTA uses an approved allowlisted destination and retains source/arm parameters. |
| SEO integrity | Canonical, index state, title, description, H1, social image, alt text, and redirect posture are signed off. |
| Attribution integrity | A controlled click records the expected Framer event and reaches the target checkout with the intended UTM/arm parameters. |
| Form / consent integrity, if a form is used | Signature validates, submission IDs are handled idempotently, email works without phone, and SMS remains optional and explicit. |
| Deployment integrity | Preview is visually verified on desktop and mobile before owner-approved production deployment. |

## Approval-gated next actions

No action is required to keep the current Kajabi price-test work moving. If you decide to explore Framer, the first approval should be narrow: **create one isolated Framer pilot project and a read-only Content Hub integration specification**. Do not connect a production domain, load live paid traffic, copy customer reviews, migrate WordPress content, add tracking code, create a webhook, or publish automatically in that first step.

Separate confirmation would be required for each of the following: adding a Framer Server API key; installing the `framer-api` dependency; creating or modifying a Framer project/CMS/page; connecting a custom domain; adding Meta Pixel, tag manager, or conversion scripts; receiving form data; starting an A/B test; promoting a deploy; or routing paid traffic.

## References

[1]: https://www.framer.com/developers/server-api-introduction "Framer Server API introduction"  
[2]: https://www.framer.com/developers/server-api-quick-start "Framer Server API quick start"  
[3]: https://www.framer.com/help/articles/guide-to-seo-features-and-tools/ "Framer SEO features and tools"  
[4]: https://www.framer.com/help/articles/how-to-run-an-a-b-test-on-your-framer-site/ "Framer native A/B testing"  
[5]: https://www.framer.com/developers/cms "Framer CMS developer documentation"  
[6]: https://www.framer.com/solutions/seo-website-builder/ "Framer SEO website builder overview"  
[7]: https://www.framer.com/updates/framer-convert "Framer Convert announcement"  
[8]: https://www.framer.com/help/articles/how-to-install-meta-pixel/ "Add Meta Pixel to a Framer site"  
[9]: https://www.framer.com/help/articles/how-to-track-custom-events-in-framer/ "Track custom events in Framer"  
[10]: https://www.framer.com/help/articles/framer-form-webhook-setup/ "Connect Framer forms to a webhook"  
[11]: https://www.framer.com/pricing "Framer pricing and Convert add-on"
