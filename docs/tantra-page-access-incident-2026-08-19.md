# Tantra Content Landing-Page Access Incident — August 19, 2026

## Initial Observation

The owner reported that none of the seven Tantra content landing pages appeared to open.

## Public Route Check

All seven URLs returned HTTP 200 without redirecting as of the initial check:

| Route | HTTP status | Initial response time |
|---|---:|---:|
| `/tantra/considering-divorce` | 200 | 10.92s |
| `/tantra/king-and-queen` | 200 | 4.47s |
| `/tantra/sex-is-the-flower` | 200 | 5.96s |
| `/tantra/why-he-stopped` | 200 | 6.00s |
| `/tantra/love-bank` | 200 | 6.88s |
| `/tantra/why-she-stopped` | 200 | 4.69s |
| `/tantra/female-orgasm` | 200 | 6.56s |

## Browser Reproduction

In the owner’s connected browser, `/tantra/considering-divorce` rendered its Urban Monk header, page headline, written content, and quiz call to action. Its embedded Wistia area rendered as a blank black rectangle rather than a visible player.

The direct Wistia iframe endpoint for that video (`sq3dol4frw`) returned HTTP 200 and exposed its expected 9:03 duration in the DOM after loading, but the player surface still appeared white/blank in the connected browser. The browser also showed a video-download extension surface; this is a possible local-player interaction but is not yet proven as the cause.

## Current Hypothesis

The public routes are available. The reported access issue appears more likely to involve delayed or visually blank Wistia playback, potentially compounded by browser-local extension behavior, rather than seven missing Content Hub routes. No Tantra page, Wistia embed, tracking behavior, or quiz routing was changed during this investigation.
