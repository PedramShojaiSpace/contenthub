# Interconnected Screening V2 — Kajabi Campaign HTML Package

**Prepared:** 2026-09-30  
**Status:** HTML package only. No Kajabi campaign, sequence, trigger, subscriber, or send was created or changed.

## What changed

The ten `Watch today’s episode` CTAs now point to the owner-supplied, published Kajabi episode URLs. Every other CTA destination was retained after a live HTTP response check. The two inherited URLs already tagged `utm_source=klaviyo` now use `utm_source=kajabi` because this is a Kajabi email package; campaign, medium, content, and destination remain unchanged.

## What is included

- `html/` — 20 standalone, Kajabi-safe email bodies in send order.
- `sequence-manifest.json` — subjects, preview text, schedule, CTA map, and a precise record of the 12 URL edits.
- This README.

## Schedule

- Day 0 primary: immediately after enrollment; Day 0 follow-up: 4 hours later.
- Days 1–3 primary: daily; follow-up: 4 hours after each primary.
- Days 4–5: primary only.
- Days 6–10 primary: daily; follow-up: 4 hours after each primary.

## VA paste instructions

1. Create a new Kajabi email sequence or campaign workflow in **draft/no trigger** status.
2. Create one email for each matching file, following the send order in `sequence-manifest.json`.
3. Paste the complete corresponding file from `html/` into Kajabi’s HTML/source editor. Do not paste it into the visual text field.
4. Copy the subject and preview text from the manifest. Keep every email in draft until the whole 20-message set is reviewed.
5. Send a single internal test only after all emails have been pasted. Click every CTA in that test before activation.

## Episode destination map

| Episode | Current Kajabi destination |
| --- | --- |
| 1 | https://theacademy.theurbanmonk.com/IChtmlEp1408rf |
| 2 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-2dsfgsd |
| 3 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-3afdsgggh |
| 4 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-4mdfsaaqa3 |
| 5 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-5oiujdfsva2 |
| 6 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-6dgfhea56 |
| 7 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-7aerfasd45 |
| 8 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-8zefgw65 |
| 9 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-9sgwtr64 |
| 10 | https://theacademy.theurbanmonk.com/interconnected-free-screening-html-version-episode-10dfvaey97k |
