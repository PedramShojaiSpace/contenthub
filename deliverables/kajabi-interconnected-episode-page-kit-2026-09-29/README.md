# Kajabi Interconnected Episode Page Design Kit

**Purpose:** a consistent, full-width visual section for the Interconnected episode landing pages hosted in Kajabi. These are presentation-only components; they do not change an offer, product, opt-in, automation, email sequence, payment, or page until pasted and saved in Kajabi.

## What is included

- Ten standalone custom-code sections, one per episode.
- A shared dark navy / blue visual system modeled on the Interconnected pages: generous spacing, strong white typography, restrained blue accent, responsive 16:9 video frame, and a full-width layout.
- Approved Wistia iframe embeds for Episodes 1, 2, and 4–10, based on the current Kajabi page sources.
- Episode 3 is deliberately a native-video placeholder: the publicly available source did not expose a portable Wistia ID, so preserve its existing Kajabi video block or insert the approved media ID when available.

## How to use each section

1. In the matching Kajabi landing page, add a **Custom Code** / **Custom HTML** section where the existing video section sits.
2. Paste the matching `episode-XX-kajabi-section.html` file.
3. Preview desktop and mobile. The section intentionally escapes a narrow page column to render full width without changing your global theme.
4. For Episode 3 only, replace the placeholder with the existing Kajabi video block or its approved Wistia ID.
5. Keep the existing Kajabi page URL until all email links and QA have been switched together.

## Safety boundary

This kit is not published anywhere. It gives the Kajabi versions the same visual language as the Interconnected pages while keeping Kajabi as the host and source of entitlement. It does not add timers or false expiry behavior. If a time-limited viewing window is used, its timing must be configured and tested independently in Kajabi.
