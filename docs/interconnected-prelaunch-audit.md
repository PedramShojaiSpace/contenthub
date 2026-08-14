# Interconnected Pre-Launch Audit

Generated: 2026-08-14T19:59:25.243Z

## Scope

The audit reviewed 27 email actions in `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` (flow status: **live**) without changing any Klaviyo content, status, or trigger.

## Summary

| Check | Result |
|---|---:|
| Email actions reviewed | 27 |
| Live messages | 1 |
| Draft messages | 26 |
| Messages missing address token in HTML | 1 |
| Messages with malformed/placeholder links | 0 |
| Messages needing explicit UTM review | 0 |
| Messages with time-sensitive urgency | 10 |
| Messages with legacy discount language | 6 |
| Messages with health-claim review flags | 23 |

## Message-by-Message Review

| Message | Status | Subject | Address | Unsubscribe | Tracking | Review flags |
|---|---|---|---|---|---|---|
| Day 0 opt in EG sp26 | live | Your spot is confirmed. Here's what happens next. | No | Yes | Auto | Missing organization address in HTML; timeSensitiveUrgency |
| IC Free Screening - Episode 1 | draft | Your free access to groundbreaking INTERCONNECTED health discoveries starts now | Yes | Yes | Auto | episodeCountLanguage; regulatedClaimReview |
| IC FS Day 1 2/2 | draft | I was dying in the hospital at 14... until I discovered this | Yes | Yes | Auto | regulatedClaimReview |
| IC FS Ep 2 | draft | The Human Microbiome: The Raging Battle Within - [Interconnected Episode 2] | Yes | Yes | Auto | legacyDiscountLanguage; regulatedClaimReview |
| IC FS Ep 3 1/2 | draft | The Truth About Probiotics [Interconnected Episode 3] | Yes | Yes | Auto | timeSensitiveUrgency; episodeCountLanguage; regulatedClaimReview |
| IC FS Ep 3 2/2 | draft | Throwing the baby out with the bath water: antibiotics aren't all bad and why probiotics might be a problem | Yes | Yes | Auto | legacyDiscountLanguage; regulatedClaimReview |
| IC FS Ep 4 1/2 | draft | Episode 4: Staying alive in a toxic world | Yes | Yes | Auto | regulatedClaimReview |
| Upstream Replay | draft | The gut health industry is lying to you. | Yes | Yes | Auto | regulatedClaimReview |
| IC FS Ep 5 1/2 | draft | Episode 5: The microbiome — your kid's inner ecosystem | Yes | Yes | Auto | none |
| Push to KBMO webinar | draft | Signs of a leaky gut | Yes | Yes | Auto | legacyDiscountLanguage; regulatedClaimReview |
| IC FS Ep 6 1/2 | draft | Episode 6: Thyroid, obesity, and diabetes | Yes | Yes | Auto | timeSensitiveUrgency; regulatedClaimReview |
| Push to Naomi Webinar | draft | How can we know what's wrong with certainty? | Yes | Yes | Auto | none |
| IC FS Ep 7 1/2 | draft | Episode 7: Cancer, Immunity and Heart Disease | Yes | Yes | Auto | timeSensitiveUrgency; regulatedClaimReview |
| Push to DSS | draft | How a bad microbiome disrupts your sleep | Yes | Yes | Auto | regulatedClaimReview |
| IC FS Ep 8 1/2 | draft | Episode 8:  Ancient Wisdom Meets Modern Tech | Yes | Yes | Auto | timeSensitiveUrgency; regulatedClaimReview |
| Lights On Webinar | draft | Your gut is talking. Are you listening? | Yes | Yes | Auto | none |
| IC FS Ep 9 1/2 | draft | Episode 9: A Personalized Approach to Medicine | Yes | Yes | Auto | regulatedClaimReview |
| IC FS Ep 9 2/2 | draft | "My labs are fine" — are they, though? | Yes | Yes | Auto | timeSensitiveUrgency; legacyDiscountLanguage; regulatedClaimReview |
| IC Day 10 Offer Extended  1/2 | draft | Your free access ends tomorrow — here's what comes next | Yes | Yes | Auto | timeSensitiveUrgency; legacyDiscountLanguage; episodeCountLanguage; regulatedClaimReview |
| IC Day 10 Offer Extended  2/2 | draft | One more thing before your access closes | Yes | Yes | Auto | timeSensitiveUrgency; legacyDiscountLanguage; regulatedClaimReview |
| IC Day 11 - Down Day | draft | Your free access has ended — but the work doesn't have to | Yes | Yes | Auto | regulatedClaimReview |
| Vibe Webinar | draft | A device that calms the vagus nerve and helps with inflammation | Yes | Yes | Auto | regulatedClaimReview |
| Day 11- VIBE | draft | Did you catch the webinar? (Replay is still up) | Yes | Yes | Auto | regulatedClaimReview |
| IC FS Ep 10 1/2 | draft | Episode 10 is here — the final piece of the puzzle...a BONUS | Yes | Yes | Auto | timeSensitiveUrgency; episodeCountLanguage; regulatedClaimReview |
| IC FS Ep 10 2/2 | draft | Wrapping Episode 10 — what I'd recommend for you | Yes | Yes | Auto | timeSensitiveUrgency; episodeCountLanguage; regulatedClaimReview |
| IS Gut Testing Only | draft | What if the problem started in your mouth? | Yes | Yes | Auto | regulatedClaimReview |
| Oral Health Intro- Lora and Elmira | draft | What if the problem started in your mouth? | Yes | Yes | Auto | regulatedClaimReview |

## Interpretation

The address/footer findings are structural. The urgency, legacy-offer, episode-count, and health-claim entries are **human review prompts**, not automatic compliance determinations. They identify copy that should be checked against the actual offer timing, episode count, and approved claim language before the flow is activated.
