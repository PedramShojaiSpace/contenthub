# Curt Handoff: Meta Access Application and Tantra Draft Completion

**Prepared for:** Curt  
**Prepared:** August 14, 2026  
**Purpose:** Complete the remaining Meta app-access application and finish the paused first-wave Tantra content-ad drafts. This is a **no-spend, review-first** workflow.

## Executive Summary

The landing pages, Wistia videos, thumbnail covers, ad-copy packages, UTM convention, and quiz measurement are complete. Meta is preventing automated creation of additional paused ads because the published **Urban Monk Ads Manager** developer app has `ads_management` marked **Ready for testing** and its **Marketing API Access Tier** marked **Limited access**. Existing read/reporting calls still work, but Meta rejects Marketing API ad-object creation with error `(#3) Application does not have the capability to make this API call`.

> No active campaign, spend, existing creative, or live destination was changed while this was investigated.

## What Is Already Complete

| Area | Status | Notes |
|---|---|---|
| Seven content landing pages | Complete | Each route contains its matching finalized Wistia video and a soft Tantra Quiz CTA. |
| Wistia cover images | Complete | Seven 2560 × 1440, 16:9 JPEGs were created and delivered for upload. |
| Content-first ads | Complete on paper | Each of the seven stories has three policy-safe static-ad variants with matched destination and UTM values. |
| Measurement | Complete | Content pages record PageView; quiz completion/email capture records CompleteRegistration and Lead; downstream checkout and purchase remain measurable. |
| Existing content draft | Present and paused | `DRAFT — UM — Tantra Content Education — Traffic — US` contains a Considering Divorce draft. |
| Draft browser fallback | Partially prepared, unpublished | A King and Queen campaign/ad set/ad was duplicated and renamed, but still inherits the Divorce creative and URL. Do **not** publish it until completed or discard it. |

## The One Meta Application Curt Needs To Complete

Open the published developer app:

**https://developers.facebook.com/apps/2150724875769823/use_cases/?business_id=1153112761372733**

Go to **Use cases → Create & manage ads with Marketing API → Customize → Permissions and features**.

| Item | Current state observed | Action required |
|---|---|---|
| `ads_management` | Ready for testing | Use **Actions** to request the available production/advanced access. Complete Meta’s requested application questions and any business-verification step. |
| Marketing API Access Tier | Limited access | Use **Actions** to request the next available access tier or complete any requirement Meta presents. |
| Other permissions | Not required for this work | Do not add `pages_manage_ads`, catalog permissions, or unrelated use cases just for this campaign. |

When the request is submitted or approved, notify the Content Hub operator. The system can then retry controlled paused-draft creation. Do not alter the app’s publish status, existing Marketing API use case, or unrelated configurations.

## What to Do After Meta Access Is Restored

### Preferred path: Content Hub creates paused drafts

Use the Content Hub **Ads → Content Traffic** workspace to create these two paused packages:

1. **King and Queen** — three matched variants, each routed to `/tantra/king-and-queen`.
2. **For Men** — three matched variants, each routed to `/tantra/why-he-stopped`.

They must remain **Paused / In draft** for owner review. Do not activate, submit for publishing, or change spend.

### Browser fallback: correct or discard the partial King and Queen copy

The partial fallback draft has these saved identifiers:

| Level | Current name | Meta ID |
|---|---|---|
| Campaign | `DRAFT — UM — King and Queen — Traffic — US` | `52524476029676` |
| Ad set | `DRAFT — Content — King and Queen — US — LPV` | `52524476029476` |
| Ad | `DRAFT — King and Queen — A — Rebuild the Field` | `52524476029876` |

This object is **not publish-ready** because it still inherits the Considering Divorce creative and destination. Either discard it and use the preferred Content Hub path after access is restored, or update it fully with the next table before any review-to-publish step.

## Exact First-Wave Routing and UTM Values

| Package | Destination | Required UTM content | Required settings |
|---|---|---|---|
| Considering Divorce | `https://content.theurbanmonk.com/tantra/considering-divorce` | `considering-divorce_a`, `_b`, `_c` | Traffic → Website → Landing Page Views; US only; paused for review. |
| King and Queen | `https://content.theurbanmonk.com/tantra/king-and-queen` | `king-and-queen_a`, `_b`, `_c` | Traffic → Website → Landing Page Views; US only; paused for review. |
| For Men | `https://content.theurbanmonk.com/tantra/why-he-stopped` | `why-he-stopped_a`, `_b`, `_c` | Traffic → Website → Landing Page Views; US only; paused for review. |

Use this URL pattern for each variant:

```text
https://content.theurbanmonk.com/tantra/<slug>?utm_source=meta&utm_medium=paid_social&utm_campaign=tantra_content_education&utm_content=<package>_<variant>
```

Use **Learn More** as the CTA. Preserve broad US 35–65+ delivery, do not use sensitive-personal-attribute targeting, and keep the content creative relationship-education focused.

## Owner Review Before Any Activation

The owner must review the three first-wave groups before activation:

1. **Considering Divorce** existing paused draft.
2. **King and Queen** paused draft package.
3. **For Men** paused draft package.

At review, confirm the actual image/video cover, ad text, Wistia landing-page video, CTA, UTM string, and off/paused status. The owner—not Curt—will decide whether an ad is moved from **Paused/Draft** to active.

## Do Not Do

Do not increase budget, change active ads, replace the Shopify primary Meta pixel, send cold traffic directly to a Tantra product checkout, target people based on presumed health conditions or relationship status, or submit any campaign for publishing without the owner’s review.

## Reference Documents

- `docs/curt-tantra-content-page-ad-routing-map-2026-08-14.md` — full seven-page ad routing map.
- `docs/tantra-meta-launch-readiness-and-destination-strategy-2026-08-14.md` — content-first versus direct-to-quiz rationale.
- `docs/meta-marketing-api-write-capability-check-2026-08-14.md` — developer-app access evidence and troubleshooting record.

## Official Reference

[1] Meta for Developers, [Marketing API authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization/). 
