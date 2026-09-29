# Interconnected Screening V2 — Draft Build and Kajabi Handoff

**Date:** 29 September 2026  
**Status:** **Staged only — no recipient was enrolled or contacted.**

## What is complete

The owner-approved `Interconnected-Two-Emails-Daily-Editable-for-Kajabi-DONE.docx` was normalized into a single 20-send source of truth:

- **11 primary sends** (Days 0–10)
- **9 follow-ups**, scheduled **four hours after** the primary on Days 0, 1, 2, 3, 6, 7, 8, 9, and 10
- **No follow-up on Days 4 or 5**

### Klaviyo staging

Twenty standalone, custom-HTML templates now exist in Klaviyo Content → Templates under this exact prefix:

> `[DRAFT — V2 REVIEW] Interconnected Screening`

They are **not connected to any sending action**, have no automatic enrollment capability, and do not change the current Unified LP-3 live flow (`THZhTS`). They preserve the approved source-document destinations and Klaviyo personalization tokens.

The source flow remains untouched because attaching a replacement template or inserting a new action into an active path would change the behavior of live traffic immediately. A draft template library provides the reviewable, reversible staging layer until an owner-approved cutover window.

### Kajabi staging

The matching **20 Kajabi-safe HTML bodies** were generated. They:

- use Kajabi’s `{{first_name}}` token;
- route episode CTAs to the existing Kajabi episode-view pages, with no Klaviyo-only access token;
- send the permanent-access $99 CTA to the existing Kajabi offer at `https://theacademy.theurbanmonk.com/offers/ofRhsQvo`;
- retain all other owner-approved CTA URLs;
- intentionally leave the owner-supplied $499 bundle on its supplied Shopify destination because no Kajabi offer equivalent was provided.

A separate **draft-only Kajabi email sequence** still needs to be created in the authenticated Kajabi admin. Its required name and exact delay logic are in the implementation guide. It must remain at zero subscribers and without a trigger until the owner approves activation.

### Kajabi episode-page visual kit

A 10-file full-width custom-code kit recreates the Interconnected visual system for Kajabi-hosted episode pages:

- navy / blue design system and Urban Monk logo;
- responsive 16:9 Wistia frame;
- current Wistia embed IDs for Episodes 1, 2, and 4–10;
- a deliberately marked native-video placeholder for Episode 3 because its current public Kajabi source did not expose a portable Wistia ID;
- no timers, expiry logic, opt-in functionality, or publishing action.

## Quality controls completed

| Check | Result |
|---|---|
| Approved send count | 20 (11 primary + 9 follow-up) |
| Day 4 / Day 5 second emails | Excluded |
| Klaviyo template staging | 20 custom-HTML standalone templates created |
| Kajabi HTML files | 20 generated; no Klaviyo access token or `person.*` token remains |
| Visual kit | 10 sections generated; 9 approved Wistia embeds, 1 explicit Episode 3 placeholder |
| Current live Unified LP-3 flow | Unchanged |
| Recipient enrollment / sends | None created by this work |

## Remaining controlled steps

1. Create the Kajabi sequence **`[DRAFT — V2 REVIEW] Interconnected Screening — 20 Email Cadence`** while authenticated in Kajabi.
2. Paste each matching `kajabi-html` body in order and configure the documented cadence. Add no trigger and no recipients.
3. Preview with an entitled test account; verify every CTA, desktop/mobile rendering, and Episode 3 native-video source.
4. Obtain owner approval before connecting new content to the current Klaviyo live flow or activating the Kajabi sequence.
5. Only in an approved cutover window, exchange old actions/templates or use a new reviewed V2 flow atomically—never mix the two live cadences in a way that can create duplicates.

## Artifacts

- [Draft sequence implementation guide](/home/ubuntu/Downloads/Interconnected-Screening-V2-Draft-Sequence-Implementation-Guide-2026-09-29.docx)
- [Combined Kajabi/Klaviyo draft packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Draft-Sequence-and-Kajabi-Design-Kit-2026-09-29.zip)
- Source folders:
  - `deliverables/interconnected-screening-v2-sequence-2026-09-29/`
  - `deliverables/kajabi-interconnected-episode-page-kit-2026-09-29/`
