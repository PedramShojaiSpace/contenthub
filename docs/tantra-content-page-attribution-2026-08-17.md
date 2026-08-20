# Tantra Content-Page Attribution Workflow

**Status:** Implemented on August 17, 2026. The seven public Tantra video landing pages now carry first-party attribution into the quiz and the existing Tantra Funnel dashboard. The implementation does not alter quiz questions, clinical routing, product claims, checkout destinations, storefront navigation, Meta campaign delivery, or pixel configuration.

## Measurement Model

Each content page creates a durable anonymous first-party visitor ID in the visitor’s browser and records page hits. The page also subscribes to Wistia’s supported Player API events for play, 25%, 50%, and 75% watched, and completion; these are the event types provided by Wistia for embedded-player engagement measurement.[1] The soft quiz CTA keeps the visitor’s existing UTMs, adds the content-page source and anonymous visitor ID, records the CTA click, and then proceeds to the same `/quiz/tantra` experience.

| Stage | Measured field | Definition |
|---|---|---|
| Page reach | Page hits and unique visitors | Every content-page load; dashboard separates total hits from unique first-party visitor IDs. |
| Video engagement | Plays; 25%, 50%, 75%; completed | Unique visitors reaching each Wistia engagement event. |
| Quiz progression | CTA clicks; quiz starts; completed quizzes; captured emails | Source ID persists when the quiz session is created. |
| Revenue | Paid units and attributed revenue | Exact first-party email match from a source-tagged, email-captured quiz lead to a paid Shopify webhook line item for Tantra Him, Tantra Her, or Tantra Bundle. The lead email must precede the order. |

> **Attribution boundary:** This is forward-looking first-party measurement. It does not invent historic source-page credit, and it does not add page-level figures to another attribution view. A sale appears only after the paid Shopify order webhook has been received and only when the captured quiz email can be matched safely.

## Covered Landing Pages

| Source key | Public page | Wistia media ID |
|---|---|---|
| `considering-divorce` | `/tantra/considering-divorce` | `sq3dol4frw` |
| `king-and-queen` | `/tantra/king-and-queen` | `onvqm5rc7p` |
| `sex-is-the-flower` | `/tantra/sex-is-the-flower` | `093er5q16m` |
| `why-he-stopped` | `/tantra/why-he-stopped` | `kcvtkpe34a` |
| `love-bank` | `/tantra/love-bank` | `w2aws6tqfv` |
| `why-she-stopped` | `/tantra/why-she-stopped` | `zpqgfbnjp1` |
| `female-orgasm` | `/tantra/female-orgasm` | `1foy9s4idy` |

## Operating the Report

Open the authenticated **Tantra Funnel** dashboard at [https://content.theurbanmonk.com/tantra-funnel](https://content.theurbanmonk.com/tantra-funnel). The new **Content Page → Quiz → Sale** table displays all seven pages for the selected date range. It includes page hits, video plays, 50% watched, quiz starts, completed quizzes, paid product units, and attributable Shopify revenue. The table also shows the visitor-to-quiz-start rate for each landing page.

The first few hours after launch should be treated as instrumentation validation rather than performance evidence. After traffic reaches each page, compare the page rows by qualified progression: video play, 50% watch, quiz start, email capture, then safely matched sale. This prevents a page with high raw reach but weak downstream behavior from being mistaken for the strongest content path.

## Validation Record

The additive database migration created `source_page` and `source_visitor_id` on `tantra_quiz_leads` plus the dedicated `tantra_content_events` table. Focused coverage passed **13/13 tests**, and the production build completed successfully. The full suite completed **1,576 passing tests** with **2 unrelated external-integration failures**: Kajabi OAuth returned HTTP 403 rather than the historical accepted status set, and the Klaviyo connectivity test reported an invalid external token. Neither failure is in the Tantra attribution implementation.

## References

[1]: https://docs.wistia.com/docs/javascript-player-api "Wistia JavaScript Player API"
