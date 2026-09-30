# Interconnected Screening V2 — Draft Build and Kajabi Handoff

**Date:** 29 September 2026  
**Status:** **Draft-only. No recipient was enrolled or contacted.**

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

A separate **draft-only Kajabi email sequence** now exists in the authenticated Kajabi admin:

> `[DRAFT — V2 REVIEW] Interconnected Screening — 20 Email Cadence`
> Sequence ID: `2148896062`

It has **0 subscribers** and **0 subscribe triggers**. The browser-based build did not reliably persist the approved source into the first message; it must be treated as an incomplete stock-template shell, not as a validated Day 0 deployment. The sequence remains entirely non-enrolling and will not send.

The matching 20 HTML bodies are now packaged in a **single VA-ready Word handoff** with the exact message schedule, Kajabi fields, CTA destinations, and paste instructions. The packet is the authoritative implementation source. It supersedes reliance on the incomplete browser-built sequence. The HTML uses the actual Kajabi destinations, and five owner-supplied scheme-less URLs were safely normalized to `https://` so the paste-ready links are valid.

During final destination validation, the generated Episode 3 `-SP26` URL returned 404. It was corrected in the HTML, Word packet, and ZIP to the currently published **`https://theacademy.theurbanmonk.com/episode-view-page-eg-ep-3`**, which returned HTTP 200. This is a destination correction only; no copy or timing changed.

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
| Kajabi HTML files | 20 generated; no Klaviyo access token or `person.*` token remains; all 22 CTA URLs are absolute |
| Kajabi draft sequence | Created; ID `2148896062`, 0 subscribers, 0 triggers; **incomplete stock-template shell, not a validated content deployment** |
| VA handoff packet | 20 complete HTML bodies, Word packet and ZIP validated; no blank pages or invalid CTA URLs |
| Visual kit | 10 sections generated; 9 approved Wistia embeds, 1 explicit Episode 3 placeholder |
| Current live Unified LP-3 flow | Unchanged |
| Recipient enrollment / sends | None created by this work |

## Remaining controlled steps

1. Use the VA packet to paste **all 20** matching `kajabi-html` bodies in order and configure the documented cadence. Add no trigger and no recipients.
2. Preview with an entitled test account; verify every CTA, desktop/mobile rendering, and Episode 3 native-video source.
3. Obtain owner approval before connecting new content to the current Klaviyo live flow or activating the Kajabi sequence.
4. Only in an approved cutover window, exchange old actions/templates or use a new reviewed V2 flow atomically—never mix the two live cadences in a way that can create duplicates.

## Artifacts

- **Kajabi wide native-shell packet (30 September):** The former paste package was visually cramped because it put a complete 640px email document (outer canvas, card, header, body, CTA rows, and footer) inside Kajabi’s own native email canvas. The replacement package contains 20 **source-mode content fragments** for a single Kajabi Text section. Each fragment removes the outer document/canvas, second `max-width:640px` card, and custom footer while retaining the Interconnected navy header, 18px body copy, CTA buttons, all visible copy, and every approved CTA URL. The native Kajabi Footer is intentionally retained for unsubscribe/address compliance. The Day 0 prototype inside the existing draft-only sequence had its inherited header and decorative image sections removed and was saved as the clean native shell; no recipient, trigger, send, live automation, checkout, offer, price, traffic, or ad setting changed. The browser lost the ability to confirm the final custom-template naming dialog, so treat the globally reusable name **`Interconnected — Wide Native Canvas`** as a required final save step rather than an already verified account-level template. Automated validation confirms 20 fragments, no full-document/640px wrapper, preserved CTA hrefs, exactly two Day 0 video-led links, no direct `$99` offer href, retained 18px paragraphs, no old episode/access links, and 20 byte-matched `.txt` sources. Desktop/mobile Day 0 and a dual-CTA Day 2 render were visually reviewed; Word packet layout and both ZIP files were validated. No activation occurred.

  - [Kajabi wide native-shell Word handoff](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-Wide-Native-Shell-Handoff-2026-09-30.docx)
  - [Kajabi wide native-shell complete packet ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-Wide-Native-Shell-Complete-Packet-2026-09-30.zip)
  - [Kajabi wide native-shell separate text fragments ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-Wide-Native-Shell-Text-Fragments-2026-09-30.zip)

- **Current Kajabi episode URL package (30 September):** The owner published ten new Kajabi-hosted episode pages. A replacement 20-email campaign package now maps each `Watch today’s episode` CTA to those exact published URLs, with no Klaviyo access tokens. All ten new pages and all existing non-episode CTA destinations returned HTTP 200 during validation. The only non-destination adjustments were two inherited `utm_source=klaviyo` values, which were normalized to `utm_source=kajabi` for this Kajabi email package. No Kajabi campaign, recipient, trigger, send, live Klaviyo flow, or existing message was changed. Use the current 30 September package rather than the prior 29 September VA packet for any new Kajabi campaign build.

  - [Current Kajabi campaign HTML ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-HTML-Current-Episode-URLs-2026-09-30.zip)
  - [Current Kajabi campaign paste-ready Word packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-HTML-Current-Episode-URLs-Paste-Ready-2026-09-30.docx)

- **Final 18px clean-format package (30 September):** This is the authoritative replacement for the preceding current-episode URL and minified/optimized packets. It retains every current Kajabi episode URL and other CTA destination, restores readable 18px Arial/Helvetica body typography with 1.6 line-height and 20px paragraph spacing, combines signatures, repairs 22 formatting fragments (including Day 0’s split `from Interconnected — ...` sentence), and keeps full CTA buttons. Automated validation confirms 20 HTML files, exact source-link preservation, no legacy `interconnected.theurbanmonk.com/episode...` route or `ic_access` token, no orphan `Interconnected`/punctuation paragraphs, and an 18px style on every body paragraph. Browser rendering of Day 0 and Day 2 was visually reviewed. No Kajabi campaign, recipient, trigger, send, live Klaviyo flow, or existing message changed.

  - [Final 18px Kajabi HTML ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-18pt-Clean-Paste-Ready-2026-09-30.zip)
  - [Final 18px Kajabi paste-ready Word packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-18pt-Clean-Paste-Ready-2026-09-30.docx)

- **Final 18px video-led $99 routing package (30 September):** This is the authoritative replacement for the preceding 18px clean package where the two Day 0 $99 offer CTAs opened the Kajabi offer directly. Email 01 (Day 0 primary) and Email 02 (Day 0 follow-up) now open the approved video-led offer-information page at `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`. Public validation returned HTTP 200, confirmed approved Wistia video `223ond81ki`, and confirmed the page’s tracked handoff to the Kajabi $99 checkout `ofRhsQvo/checkout`; no order or checkout test was placed. All other 18 HTML files are byte-identical to the prior clean package, and all other copy, CTA labels, CTA URLs, and cadence details are preserved. Automated validation confirms 20 HTML files, exactly two rerouted CTAs, no remaining direct `$99` offer href in email HTML, retained 18px formatting, 20 byte-matched individual text files, clean Day 0 browser renders, and valid full/text ZIP archives. No Kajabi campaign, recipient, trigger, send, live Klaviyo flow, checkout, offer, price, traffic, or automation changed.

  - [Final video-led $99 Kajabi full packet ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-18pt-Video-Led-99-Full-Packet-2026-09-30.zip)
  - [Final video-led $99 Kajabi paste-ready Word packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-18pt-Video-Led-99-Paste-Ready-2026-09-30.docx)
  - [Final video-led $99 Kajabi separate text-file ZIP](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-18pt-Video-Led-99-Text-Files-2026-09-30.zip)

- [Draft sequence implementation guide](/home/ubuntu/Downloads/Interconnected-Screening-V2-Draft-Sequence-Implementation-Guide-2026-09-29.docx)
- [Combined Kajabi/Klaviyo draft packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Draft-Sequence-and-Kajabi-Design-Kit-2026-09-29.zip)
- [VA-ready Kajabi HTML Word packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-VA-HTML-Paste-Ready-Packet-2026-09-29.docx)
- [VA-ready Kajabi HTML ZIP packet](/home/ubuntu/Downloads/Interconnected-Screening-V2-Kajabi-VA-HTML-Paste-Ready-Packet-2026-09-29.zip)
- Source folders:
  - `deliverables/interconnected-screening-v2-sequence-2026-09-29/`
  - `deliverables/kajabi-interconnected-episode-page-kit-2026-09-29/`
