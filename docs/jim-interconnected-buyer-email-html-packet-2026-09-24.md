# Interconnected $67/$99 Buyer Email HTML Packet

**Status:** Ready for Jim to load into the existing Kajabi **draft** buyer sequence. This packet is not an activation package.

## Purpose

This handoff converts the owner-approved Word source `Interconnected-67-99-Buyer-Email-Final-Copy-Review-2026-09-24(1)(1).docx` into ten standalone, Kajabi-safe HTML fragments. It is the replacement for the prior 23 September packet, which predates the owner’s latest copy revisions.

## Delivery files

The Word reference and delivery archive are stored in Downloads:

- `Jim-Interconnected-Buyer-Email-HTML-Paste-Ready-Packet-2026-09-24.docx`
- `Jim-Interconnected-Buyer-Email-HTML-Paste-Ready-Packet-2026-09-24.zip`

The ZIP contains an `html/` folder with one HTML fragment per email, a plain-text README, and `manifest.json` with the timing, subject, preview, and CTA destinations for each message.

## Content and link validation

All ten email bodies are sourced from the revised owner Word file. The packet contains nineteen owner-approved CTA links across the ten emails, plus the one existing `mailto:support@theurbanmonk.com` access-support link. Each HTML file uses the same restrained Urban Monk presentation: Arial, a blue wordmark, a gold divider, white background, and blue underlined text CTAs.

The validation pass confirmed that all ten HTML fragments parse cleanly, contain no raw `{{TOKEN}}` placeholders, no `#` destination, no full-document `<html>` or `<body>` wrapper, and preserve the exact source-document CTA labels and links. The public secondary destinations returned HTTP 200 at the time of validation. Kajabi’s library and paid-course routes returned HTTP 403 to the unauthenticated validator, which is consistent with their buyer-access protection; the corresponding owner-approved URLs are embedded exactly as supplied.

## Loading boundary

Jim should use the `.html` files from the ZIP—not Word—as the actual copy source. The destination Word document is a human-readable review and lookup guide. The sequence must remain **[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99**, with no subscriber trigger, enrollment, or activation. After loading each message, Jim should save, reopen it, and later use an owner-approved internal test to confirm both the rendered body and its recipient-facing links.

No Kajabi automation, trigger, enrollment, email send, offer, checkout, price, buyer record, traffic, or ad setting changed while producing this packet.
