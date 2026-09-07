# Content Hub → Framer Interface Specification

**Prepared for:** The Urban Monk  
**Purpose:** Define how the Content Hub can become the central request, governance, and measurement workspace for many fast Framer landing pages without becoming the public campaign host.  
**Scope:** Interface and integration specification only. No Framer connection, API key, site, page, CMS collection, branch, checkout, tracking script, domain, form, publish action, or traffic rule was created or changed.

## The simple answer

The Content Hub should work like an internal **Landing Page Command Center**. A marketer starts one page request in the Hub, selects an approved offer/checkout and campaign goal, generates a structured page package, and sends that package to **Framer staging**. Framer builds and hosts the public page. The Hub remembers exactly what was sent, shows the preview link, runs the release checklist, stores the final production URL, and reconciles the page/experiment to Kajabi or Shopify sales.

The key is that there is **one intake form and one release record**, no matter how many landing pages exist in Framer.

```text
Content Hub brief + approved assets + CTA map + SEO rules
                         ↓
                 Framer draft / staging page
                         ↓
              Human visual + compliance review
                         ↓
             Explicit production-release approval
                         ↓
          Framer-hosted public page + checkout handoff
                         ↓
      Content Hub experiment registry + Kajabi/Shopify revenue
```

Framer’s Server API can interact with project CMS and canvas content, branch and preview workflows, custom code, redirects, and project publication/deployment. [1] [2] The interface should deliberately use only the **draft/preview subset** until a named person approves a release.

## 1. The shared campaign record

Every Framer landing page should start with one Content Hub record called a **Campaign Page**. The record is not a piece of design software; it is the single source of truth for *why* the page exists, what it is permitted to say, where it may send a visitor, and how it will be measured.

### Core record fields

| Area | Required fields | Why it matters |
|---|---|---|
| Identity | Campaign ID, page name, owner, page type, status, creation date | Stops pages from becoming anonymous one-offs. |
| Audience | Channel, campaign, audience description, traffic temperature, exclusion notes | Keeps the message matched to the source. |
| Offer | Checkout system, product/offer name, exact Kajabi Offer ID or Shopify product/variant reference, price, upsell treatment, refunds/maturity rule | Keeps commercial setup explicit and makes revenue reconcilable. |
| CTA map | Approved destination URL, allowed query parameters, CTA labels, fallback destination, redirect status | Prevents an otherwise beautiful page from sending traffic to the wrong place. |
| Content | Approved message hierarchy, claims/source references, mandatory disclosures, approved images/video, forbidden language | Enables fast AI drafting while containing accuracy and compliance risk. |
| SEO | Index/noindex status, canonical URL, page title, meta description, social image, robots rule, redirect predecessor if applicable | Prevents duplicate content and accidental ranking conflicts. |
| Measurement | UTM contract, page ID, experiment ID/arm, allowed browser events, revenue ledger, source-of-truth metric | Keeps page engagement separate from cleared transaction revenue. |
| Framer link | Project ID, branch ID, template ID, CMS item/page ID, preview URL, production URL, deployment ID | Provides an exact operational link between the Hub record and Framer. |
| Approval | Content reviewer, design reviewer, compliance reviewer if needed, launch approver, release timestamp | Provides a predictable release gate. |

### Minimal payload example

The Hub sends a structured payload rather than a vague text prompt. No secret, raw customer data, or arbitrary destination URL is part of that payload.

```json
{
  "campaignId": "agora-p1-entry-price",
  "pageId": "agora-p1-p49-ty",
  "pageType": "thank_you_offer",
  "status": "approved_for_framer_draft",
  "audience": {
    "source": "meta_paid_social",
    "campaign": "agora-p1",
    "intent": "new_interconnected_screening_registrant"
  },
  "offer": {
    "checkoutSystem": "kajabi",
    "offerId": "VA_TO_CONFIRM",
    "displayPrice": 49,
    "upsellPolicy": "same_verified_199_treatment"
  },
  "cta": {
    "label": "Continue to your Interconnected access",
    "destinationKey": "kajabi_agora_p49",
    "allowedParameters": ["utm_source", "utm_medium", "utm_campaign", "utm_content", "lp_id", "arm"]
  },
  "seo": {
    "indexPolicy": "noindex",
    "canonicalMode": "control"
  },
  "measurement": {
    "experimentId": "agora-entry-price-p1",
    "arm": "p49",
    "framerEvents": ["offer-page-view", "checkout-start"],
    "revenueAuthority": "kajabi_cleared_exact_offer"
  }
}
```

## 2. What the Content Hub interface would look like

The new area belongs in the protected Owner workspace and should be called **Landing Pages**. It should operate as one system with four screens, rather than a new page-builder inside the Hub.

| Screen | What the operator sees | Principal action | What it cannot do automatically |
|---|---|---|---|
| **Landing Pages index** | A list of every campaign page, owner, source, checkout ledger, stage, preview/live URL, experiment, and last release. | Find, filter, duplicate a *brief*, or start a new request. | Build a public page or route traffic. |
| **New page brief** | Guided fields for audience, offer, message, asset, SEO, CTA, and measurement. | Save a brief and generate a draft content package. | Create a Framer project or place a checkout URL that is not allowlisted. |
| **Page detail / launch board** | Tabs: Brief, Copy & Assets, SEO, CTA & Tracking, Framer Preview, QA, Release History, Results. | Send approved payload to Framer staging; open preview; request review. | Publish to production without a named approval. |
| **Experiment & results** | Page/arm registry, Framer immediate engagement, Kajabi/Shopify transaction results, maturity status, winner rule. | Read results and document a decision. | Treat Meta or Framer engagement data as cleared revenue. |

### The operator experience in plain language

1. The marketer clicks **New Landing Page**.
2. They choose a template: lead magnet, webinar, offer page, thank-you offer, product bridge, quiz, or evergreen resource page.
3. The Hub preloads approved brand language, current offer facts, allowed CTA destinations, legal blocks, and the correct SEO/test rules for that page type.
4. AI produces the *copy and page blueprint*, not a live website.
5. The reviewer confirms the message, claims, images, CTA, index status, and tracking label.
6. The Hub sends the finalized payload to a **Framer staging branch** or designated draft CMS item.
7. The marketer opens the Framer preview, gives visual feedback, and iterates there.
8. The Hub shows a single red/yellow/green release checklist. A release can be requested only when every required check is green.
9. A named owner approves production. Framer deploys the page. The Hub stores the live URL and begins monitoring the appropriate metrics.

## 3. How Framer receives the work

There are two useful page-delivery patterns. Use both intentionally rather than force every landing page into one method.

### Pattern A — campaign template + Framer CMS (recommended starting point)

Build a small library of Framer templates with common Urban Monk sections: hero, education, evidence/qualifier block, program transition, FAQ, CTA, legal/disclosure, footer, and thank-you/offer panel. Create a Framer CMS collection, such as `Campaign Pages`, with fields corresponding to the Hub’s approved payload.

Framer’s CMS supports collection items, unique slugs, field data, and draft status; drafts are excluded from publishing. [3] A Framer project can use CMS content to turn a reviewed Hub payload into a predictable page without rebuilding the visual system every time.

**Best for:** webinar pages, lead magnets, thank-you offer pages, product bridges, educational pages, paid social landing pages, and repeatable campaign families.

### Pattern B — bespoke Framer branch (for higher-design pages)

For a major launch, the Hub still supplies the same approved payload, but Framer creates a new page or branch from a base template. The designer or Framer AI can produce a more distinctive layout while retaining the same CTA, SEO, and tracking contract. Framer’s project branch API supports working in an isolated branch; its publishing APIs can inspect unpublished changes and deployment state. [2]

**Best for:** flagship offers, partner-specific pages, seasonal campaigns, broad brand launches, or pages where a template is too restrictive.

### Recommended first build

Start with **Pattern A**. It produces most of the speed benefit while keeping the page system structured and reviewable. Add Pattern B once the team has a reliable template library, release checklist, and standardized tracking scheme.

## 4. The integration contract

The API connection should remain behind the Content Hub server. Framer’s Server API uses a project-specific API key and can make powerful project-level changes; it should never be called from a browser or exposed in client-side code. [1] [4]

| Hub action | Framer action | Release state | Approval required |
|---|---|---|---|
| **Create draft payload** | None. The Hub stores the approved brief package. | `brief_ready` | Content reviewer |
| **Send to Framer staging** | Create/update a CMS draft item or branch/page from the approved template. | `framer_draft` | Content + design reviewer |
| **Refresh preview** | Generate/return staging preview information. | `preview_ready` | None beyond prior staging approval |
| **Run preflight** | Read page metadata/CTA map and compare with Hub record. | `qa_pending` / `qa_passed` | None; read-only |
| **Request release** | No Framer production change. | `release_requested` | Named launch owner |
| **Deploy production** | Publish/deploy only the pre-approved branch/page. | `live` | Explicit owner confirmation each release |
| **Rollback** | Restore a selected known-good Framer deployment. | `rolled_back` | Explicit owner confirmation |

The Hub should use a destination-key lookup rather than pass free-form checkout URLs to Framer. For example, `kajabi_agora_p49` can resolve to a current approved checkout URL only after the VA verifies the Offer ID and price. This ensures the page can never be pointed to a compromised, stale, or unrelated destination by an unreviewed prompt.

## 5. Page status model

Use a visible, linear status model so that marketing can move fast without losing track of what is real.

```text
brief_draft
  → copy_review
  → approved_for_framer_draft
  → framer_draft
  → preview_ready
  → qa_passed
  → release_requested
  → live
  → archived

At any stage: blocked | needs_revision | rolled_back
```

| Status | Who can set it | Meaning |
|---|---|---|
| `brief_draft` | Marketer | Idea is being structured; no Framer action. |
| `approved_for_framer_draft` | Content reviewer | Copy/asset/CTA/SEO payload is allowed to enter Framer staging. |
| `framer_draft` | Hub integration or Framer editor | A staging item/branch exists; it is not production. |
| `preview_ready` | Hub integration | The preview reference has returned and is ready for visual review. |
| `qa_passed` | Reviewer | CTA, metadata, page behavior, and tracking checks passed. |
| `release_requested` | Marketer | Launch owner must decide whether to publish. |
| `live` | Named launch owner only | Selected page/version is public on the campaign domain. |

## 6. Attribution and experiment rules

Framer can natively measure page views, funnels, A/B test variants, and custom client events. Its custom tracking IDs can be passed into its analytics funnel setup. [5] Framer’s native A/B tests are useful for questions such as “which hero or CTA gets a same-day click?” but they use daily cookie-free assignment and same-day conversions. [6]

Therefore, the Hub must keep the experiment registry and commercial outcome rules:

| Test type | Framer’s job | Content Hub’s job | Commercial authority |
|---|---|---|---|
| Hero / CTA / page composition | Deliver variation and log immediate event. | Store hypothesis, primary metric, traffic rule, and review outcome. | Framer engagement events for that on-page question. |
| Opt-in form test | Render variation and transmit permitted form event. | Verify signed receipt, consent fields, source, duplicate/retry behavior. | Verified first-party form receipt. |
| Kajabi price test | Render approved page/arm only if requested. | Sticky entrant assignment, arm/exact-offer mapping, refund maturity, winner rule. | Cleared Kajabi exact-offer revenue. |
| Shopify product path | Render approved bridge and allowlisted CTA. | Preserve affiliate/source parameters and reconcile distinct path. | Shopify orders/refunds. |

Every outbound CTA must keep the page ID and arm label, in addition to standard UTM values. A good default is:

```text
utm_source=meta
utm_medium=paid-social
utm_campaign=agora-p1
utm_content=framer-p49
lp_id=agora-p1-p49-ty
arm=p49
```

The current Kajabi price test should **not** migrate to Framer mid-experiment. It should complete in the existing controlled Kajabi/Content Hub architecture. Framer can be used for the next new campaign after the page and attribution standards are in place.

## 7. SEO controls in the workflow

Framer supports page/CMS metadata, canonical URLs, redirects, sitemap/robots features, structured data, and social previews. [7] The Hub should enforce SEO policy before a page reaches Framer:

| Hub policy selection | Framer implementation expectation |
|---|---|
| `paid_test_noindex` | Noindex page, canonical to stable control, excluded from organic experiment interpretation. |
| `campaign_control_indexable` | Approved metadata, canonical self-reference, social image, structured data only if supported by actual content. |
| `resource_indexable` | SEO review completed; internal linking, claims/references, and duplicate-content assessment completed. |
| `redirect_migration` | Approved old-to-new route map and validation plan prior to any Framer redirect change. |

The Hub should not allow AI to select an index status by itself. A page can look complete and still create organic duplication or SEO loss if its canonical and index behavior are wrong.

## 8. Forms and optional SMS

Framer forms can send submissions as JSON to an HTTPS webhook, and Framer supports webhook signing with a configured secret. [8] The form integration should be a narrow-purpose receiver—not a broad automation endpoint.

For every Framer form, the Hub must maintain: input field allowlist; signed-request verification; event ID/idempotency handling; rate limit; consent version; source/page/arm record; and a clear destination result. The system must record email consent and optional SMS consent separately. Phone number presence never means SMS permission.

No Framer form should directly create a Kajabi purchase, change a page status, launch a flow, activate a test, or publish a page. Its job is only to submit an approved lead payload to an authenticated first-party receiver.

## 9. Security and failure handling

| Risk | Design control |
|---|---|
| API key compromise | Project-specific key stored server-side only; explicit outbound kill switch; provider-side rotation procedure; no browser/client code access. |
| Accidental production publish | Draft-only API role; publish method is not available in ordinary content workflow; manual owner approval creates a release request. |
| Wrong checkout link | CTA destination keys resolve from an allowlist; required price/Offer mapping check before preview and release. |
| Duplicate content | Page type requires an SEO posture; paid/test pages default to noindex and canonical control. |
| Incorrect experiment learning | Framer engagement events stay separate from cleared Kajabi/Shopify revenue; price tests retain Hub sticky assignment and maturity rules. |
| Unwanted SMS enrollment | Separate unticked SMS consent plus consent-source record; no phone-only enrollment. |
| Webhook replay/forgery | Verify signature, use submission ID idempotency, maintain short retention, and reject malformed/duplicate records. |
| Bad release | Keep deployment/version reference and release history; rollback requires an owner-approved known-good version. |

## 10. Build order

| Phase | Deliverable | Scope boundary |
|---|---|---|
| **Phase 1 — Hub command center** | Landing Pages index, structured page brief, CTA allowlist, SEO/test policy fields, release checklist. | No Framer API or live hosting yet. |
| **Phase 2 — Framer foundation** | Dedicated Framer Growth project, component library, staging/branch rules, one non-indexed template preview. | No paid traffic, checkout, form, or production domain. |
| **Phase 3 — Draft bridge** | Server-side Framer API connection that creates/updates a CMS draft or staging branch from an approved Hub brief. | No automated production deployment. |
| **Phase 4 — First controlled launch** | One approved production page, clear checkout/UTM map, monitored engagement and ledger reconciliation. | No multi-variable experiment or uncontrolled content sync. |
| **Phase 5 — Scale library** | More templates, reusable brand sections, approved asset library, SEO resource-page workflow, and controlled Framer experiments. | Continued approval gates and periodic security review. |

## Decision requested

If you want to proceed, the best next approval is **Phase 1 plus Framer Foundation planning only**: build the protected Content Hub Landing Pages command-center interface and produce a Framer starter-project checklist/template specification. This does not require an API key or a Framer account connection yet.

Once the team confirms the chosen Framer workspace and project, a separate approval can authorize the read-only/draft-only Server API setup. A further, separate approval should be required before any custom domain, production page, checkout URL, form, tracking code, experiment, or traffic route is changed.

## References

[1]: https://www.framer.com/updates/server-api "Framer Server API announcement"  
[2]: https://www.framer.com/developers/reference "Framer developer API reference"  
[3]: https://www.framer.com/developers/cms "Framer CMS developer documentation"  
[4]: https://github.com/framer/server-api-examples "Framer Server API examples"  
[5]: https://www.framer.com/help/articles/how-to-track-custom-events-in-framer/ "Track custom events in Framer"  
[6]: https://www.framer.com/help/articles/how-to-run-an-a-b-test-on-your-framer-site/ "Run an A/B test on a Framer site"  
[7]: https://www.framer.com/help/articles/guide-to-seo-features-and-tools/ "Framer SEO features and tools"  
[8]: https://www.framer.com/help/articles/framer-form-webhook-setup/ "Connect Framer forms to a webhook"
