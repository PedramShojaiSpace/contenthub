# Interconnected Screening V2 — Kajabi Wide Native-Shell HTML Packet

**Status:** Draft-only handoff for Kajabi’s Email Visual Editor. This packet replaces the prior full-document HTML approach that put a second, fixed-width 640px email card inside the Urban Monk Kajabi theme.

## Why this packet looks better

Kajabi already supplies the outer email canvas and its compliance footer. These files are **content fragments**, not entire email documents. Each fragment fills the template’s Text section at `width="100%"` and has no `<html>`, `<head>`, `<body>`, outer background, or `max-width:640px` container. That avoids the squeezed “email within an email” effect in the preview.

> Use **one native Kajabi Text section** as the content canvas. Keep the Kajabi Footer section in place for its unsubscribe/address controls.

## Template to use

Use or save the native visual template named **Interconnected — Wide Native Canvas**. Its intended layout is:

| Keep | Remove / avoid |
| --- | --- |
| One **Text** section for the fragment | Extra header, decorative image, or logo sections above the Text section |
| Kajabi’s built-in **Footer** section | A second full HTML document or another `max-width` wrapper |
| White background | Pasting the prior `<!DOCTYPE html>...` full-email files into the visual editor |

For the cleanest width: open the template’s Text section → **Desktop Layout** → set left/right padding to `0`; repeat under **Mobile Layout**. The fragment includes its own safe `28px` side padding, so it will remain readable on phones.

## Exact paste workflow for every email

1. In the intended Kajabi email, choose **Interconnected — Wide Native Canvas** (or open the prepared native shell).
2. Open the single **Text** section.
3. Click the **Source Code** (`<>`) button in the text toolbar.
4. Select all existing source and paste the matching file from `text-source-fragments/`.
5. Save the Text section, then save the email. Keep the sequence/campaign in draft status until QC is complete.
6. Use the matching subject, preview text, and cadence in `sequence-manifest.json`.

## Required Day 0 routing check

Only the two Day 0 $99 offer buttons changed in the prior revision and remain correct here:

- `01-day-0-primary.*` → **Redeem your one-time $99 offer**
- `02-day-0-follow-up.*` → **See special offer →**

Both first open the approved explanatory page:

`https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`

That page presents the $99 offer video and then uses its tracked handoff to Kajabi checkout/native OCU. **Do not replace those two links with the direct cart URL.** All other approved destinations, copy, subjects, and timing are unchanged.

## Files

| Location | Use |
| --- | --- |
| `html-source-fragments/` | Source fragments with `.html` extensions. |
| `text-source-fragments/` | Identical source fragments with `.txt` extensions for easy opening/copying. |
| `sequence-manifest.json` | Timing, subject, preview, and CTA reference. |
| `Kajabi-Interconnected-Wide-Native-Template-Setup-Guide.md` | Step-by-step template setup and QA. |
| `qa-report.json` | Packet validation results. |

## Pre-send QA

- [ ] Exactly one Text section contains the current email fragment.
- [ ] No duplicate logo/header/card appears above it.
- [ ] Body copy is 18px and paragraphs are not fragmented.
- [ ] CTA buttons are visible, centered, and open the intended URL.
- [ ] Day 0’s two $99 CTAs open the video-led thank-you page first.
- [ ] The Kajabi Footer/unsubscribe controls are still present.
- [ ] Send an internal test of Day 0 primary and one episode email—no live recipients or trigger.
