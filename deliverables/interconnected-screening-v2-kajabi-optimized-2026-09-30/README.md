# Interconnected Screening V2 — Kajabi Optimized HTML Package

**Prepared:** 2026-09-30  
**Status:** Optimized HTML package only. No Kajabi campaign, sequence, trigger, subscriber, or send was created or changed.

## Optimizer result

All 20 emails were processed with the Content Hub Email Optimizer. Total HTML size changed from 105,693 bytes to 101,260 bytes (4% reduction). The aggregate avoidable-template score changed from 24 to 24.

The optimizer inlined styles where applicable, removed class/ID and data attributes, removed template comments and tracking-pixel patterns, stripped new-tab/rel attributes, simplified button-style CTAs to underlined text links, normalized non-ASCII/control characters, and minified each file. It did not rewrite the owner-approved body copy, subject lines, schedule, CTA labels, or destinations.

## Important placement note

The cleaner removes avoidable technical promotion signals. It cannot guarantee Gmail Primary placement because mailbox placement also depends on sender authentication, recipient behavior, and message purpose. Several approved messages intentionally contain time-bound offer language; that language can still receive Promotions classification even with clean HTML. No spam-triggering raw S3/CDN destination was detected.

## Package contents

- `html/` — 20 optimized, standalone Kajabi-safe HTML bodies in send order.
- `sequence-manifest.json` — original approved schedule, subjects, previews, and CTA map.
- `optimization-report.json` — per-email technical cleanup and signal record.
- This README.

## VA paste instructions

1. Use only the files in this optimized `html/` folder for the new Kajabi campaign/sequence.
2. Create or keep the sequence in draft status with no trigger or enrolled contacts.
3. Paste each complete HTML file into Kajabi HTML/source mode; do not use the visual text editor.
4. Use the matching subject and preview from `sequence-manifest.json`.
5. Send one internal test after the full sequence has been pasted. Click every CTA before activation.
6. Keep Kajabi’s own required unsubscribe/footer mechanism enabled; the email bodies do not attempt to replace it.

## Per-email technical summary

| File | Bytes before → after | Score before → after |
| --- | ---: | ---: |
| 01-day-0-primary.html | 4,411 → 4,208 | 2 → 2 |
| 02-day-0-follow-up.html | 3,716 → 3,532 | 2 → 2 |
| 03-day-1-primary.html | 5,790 → 5,584 | 2 → 2 |
| 04-day-1-follow-up.html | 6,827 → 6,618 | 1 → 1 |
| 05-day-2-primary.html | 5,026 → 4,666 | 1 → 1 |
| 06-day-2-follow-up.html | 5,961 → 5,756 | 1 → 1 |
| 07-day-3-primary.html | 5,144 → 4,935 | 1 → 1 |
| 08-day-3-follow-up.html | 6,156 → 5,954 | 1 → 1 |
| 09-day-4-primary.html | 4,645 → 4,447 | 1 → 1 |
| 11-day-5-primary.html | 5,820 → 5,586 | 1 → 1 |
| 13-day-6-primary.html | 5,418 → 5,192 | 1 → 1 |
| 14-day-6-follow-up.html | 5,105 → 4,903 | 1 → 1 |
| 15-day-7-primary.html | 5,596 → 5,364 | 1 → 1 |
| 16-day-7-follow-up.html | 5,296 → 5,100 | 1 → 1 |
| 17-day-8-primary.html | 5,673 → 5,459 | 1 → 1 |
| 18-day-8-follow-up.html | 4,614 → 4,425 | 1 → 1 |
| 19-day-9-primary.html | 4,634 → 4,422 | 1 → 1 |
| 20-day-9-follow-up.html | 5,275 → 5,076 | 1 → 1 |
| 21-day-10-primary.html | 5,624 → 5,264 | 2 → 2 |
| 22-day-10-follow-up.html | 4,962 → 4,769 | 1 → 1 |
