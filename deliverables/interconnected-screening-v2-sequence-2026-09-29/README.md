# Interconnected Screening V2 — Draft Build Packet

**Source:** `Interconnected-Two-Emails-Daily-Editable-for-Kajabi-DONE.docx`  
**Status:** **Draft-only.** This packet does not enroll, send, activate, or alter any live flow.

## Deliverables

- `kajabi-html/` — 20 Kajabi-safe HTML bodies using `{{first_name}}`; episode links point to the current Kajabi episode-view pages and the $99 offer points to `https://theacademy.theurbanmonk.com/offers/ofRhsQvo`.
- `klaviyo-html/` — 20 Klaviyo-ready HTML bodies preserving the approved source destinations and Klaviyo personalization token where supplied.
- `sequence-manifest.json` — exact timing, source message references, subject, preview, body, and CTA map.

## Cadence

| Day | Primary | Follow-up |
|---|---|---|
| 0 | Immediately after opt-in | +4 hours |
| 1–3 | 24 hours after preceding primary | +4 hours |
| 4–5 | 24 hours after preceding primary | **None** |
| 6–10 | 24 hours after preceding primary | +4 hours |

The complete sequence contains **20 sends**: 11 primary emails and 9 follow-ups. No follow-up was created for Days 4 or 5.

## Approval and activation boundary

1. Keep the current Unified LP-3 flow live until the new content is reviewed; editing those active actions changes copy for live recipients immediately.
2. Create a separate Kajabi sequence in **draft / no-trigger** state, then paste the matching files from `kajabi-html/` in schedule order.
3. Stage the 20 Klaviyo HTML templates as drafts. Do not attach a replacement template to a live flow action until approved.
4. Before activation, test all Kajabi episode links with an entitled account, confirm every CTA, and run a single consented SMS test only if separately authorized.

## Index

| # | Timing | Type | Subject | CTA labels | Current source |
|---:|---|---|---|---|---|
| 01 | Day 0 | Primary | Your spot is confirmed. Here's what happens next. | Redeem your one-time $99 offer | Day 0 opt in EG sp26 |
| 02 | Day 0 | Follow-Up | Your Series Screening Starts Tomorrow [this special offer ends today] | See special offer → | NEW draft follow-up |
| 03 | Day 1 | Primary | Your free access to groundbreaking INTERCONNECTED health discoveries starts now | Watch today’s episode | IC Free Screening - Episode 1 |
| 04 | Day 1 | Follow-Up | Your root cause won't fix itself | See the Webinar → | NEW draft follow-up |
| 05 | Day 2 | Primary | The Human Microbiome: The Raging Battle Within - [Interconnected Episode 2] | Explore the testing + consultation option; Watch today’s episode | IC FS Ep 2 |
| 06 | Day 2 | Follow-Up | The foods you love may be the problem | See the interview —> | NEW draft follow-up |
| 07 | Day 3 | Primary | The Truth About Probiotics [Interconnected Episode 3] | Watch today’s episode | IC FS Ep 3 1/2 |
| 08 | Day 3 | Follow-Up | Your doctor was never trained for this | See the talk → | NEW draft follow-up |
| 09 | Day 4 | Primary | Episode 4: Staying alive in a toxic world | Watch today’s episode | IC FS Ep 4 1/2 |
| 11 | Day 5 | Primary | Episode 5: The microbiome — your kid's inner ecosystem | Watch today’s episode | IC FS Ep 5 1/2 |
| 13 | Day 6 | Primary | Episode 6: Thyroid, obesity, and diabetes | Watch today’s episode | IC FS Ep 6 1/2 |
| 14 | Day 6 | Follow-Up | Too many specialists, no good answers… | See the conversation → | NEW draft follow-up |
| 15 | Day 7 | Primary | Episode 7: Cancer, Immunity and Heart Disease | Watch today’s episode | IC FS Ep 7 1/2 |
| 16 | Day 7 | Follow-Up | The mouth is the Gateway to Health | See the conversation → | NEW draft follow-up |
| 17 | Day 8 | Primary | Episode 8: Ancient Wisdom Meets Modern Tech | Watch today’s episode | IC FS Ep 8 1/2 |
| 18 | Day 8 | Follow-Up | The hidden culprit: The foods you love?!?? | You can learn more about it here —> | NEW draft follow-up |
| 19 | Day 9 | Primary | Episode 9: A Personalized Approach to Medicine | Watch today’s episode | IC FS Ep 9 1/2 |
| 20 | Day 9 | Follow-Up | Why your body won't let you sleep | Fixing my sleep —> | NEW draft follow-up |
| 21 | Day 10 | Primary | Episode 10 is here — the final piece of the puzzle...a BONUS | Review the complete $499 bundle →; Watch today’s episode | IC FS Ep 10 1/2 |
| 22 | Day 10 | Follow-Up | $12,000 in supplements. Still tired? | See the packages here —> | NEW draft follow-up |

## Link notes

- The current Kajabi episode-view paths have been used for Kajabi HTML to remove Klaviyo-only `ic_access` tokens.
- The source document's $99 offer CTAs are mapped in Kajabi to the existing Kajabi offer page; the Klaviyo HTML keeps the source thank-you destination as provided.
- The $499 bundle remains on its owner-supplied Shopify product URL because no Kajabi $499 equivalent was supplied.
