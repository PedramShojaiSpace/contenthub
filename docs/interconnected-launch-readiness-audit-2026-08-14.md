# Interconnected Klaviyo Pre-Launch Audit

**Audited flow:** `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` (`YyFZPu`)  
**Audit timestamp:** 2026-08-14 19:59 UTC  
**Scope:** 27 email actions; no message was activated or sent during this audit.

## What is structurally ready

The full flow was reviewed message by message. All 26 draft emails now use Klaviyo’s tracking-parameter setting, so their external links will be decorated consistently at send time. No malformed URLs or placeholder URLs were detected.

The postal-address issue has been corrected in every draft email. Six draft messages that lacked the organization address received the same approved footer treatment: the address now sits immediately above the unsubscribe handling. The beige design, existing body copy, link destinations, sender, reply-to address, and draft status were retained.

| Technical check | Result |
|---|---:|
| Email actions reviewed | 27 |
| Draft emails with Klaviyo tracking enabled | 26 of 26 |
| Draft emails with address + unsubscribe footer handling | 26 of 26 |
| Malformed or placeholder links | 0 |
| Sender/reply-to configurations | 1 |
| Existing live emails changed | 0 |

## One technical item to decide

The one already-live **Day 0 opt-in** email has a valid unsubscribe mechanism and tracking enabled, but its stored HTML does **not** include the organization address token. It was left untouched because it is currently live and you had asked not to replace the live Day 0 email without explicit approval.

> **Required decision before launch:** approve a footer-only address insertion in Day 0, or verify in a fresh delivered test that Klaviyo adds a compliant organization address outside the stored template. No other content change is required for that item.

## Final content-review checklist

The following are not automatic errors. They are the places where a human final pass should confirm that language reflects the offer and calendar that will be live tonight.

| Review category | Messages to inspect | Why it matters |
|---|---|---|
| Time-sensitive language | Day 0; Episode 3 (1/2); Episode 6 (1/2); Episode 7 (1/2); Episode 8 (1/2); Episode 9 (2/2); Day 10 Offer Extended (1/2 and 2/2); Episode 10 (1/2 and 2/2) | Confirm references such as “tonight,” “tomorrow,” “midnight,” “last chance,” and “final chance” match the actual send time and expiry. |
| Legacy offer language | Episode 2; Episode 3 (2/2); Push to KBMO webinar; Episode 9 (2/2); Day 10 Offer Extended (1/2 and 2/2) | Confirm legacy “50% off,” “package discount,” “Upstream Bundle,” or “Upstream Package” wording matches the current $67 / $199 offer architecture. |
| Episode-count references | Episode 1; Episode 3 (1/2); Day 10 Offer Extended (1/2); Episode 10 (1/2 and 2/2) | Confirm “10-day,” “Episode 10,” and bonus-episode wording matches the current series delivery plan. |
| Health-claim language | 23 messages triggered a human-review flag | Check disease, symptom, and outcome language against your approved clinical/compliance standards; this audit made no copy changes. |
| Blank preview text | Day 0; Episode 1; Day 1 (2/2); Episode 2; Episode 3 (1/2) | Optional, but adding a tailored preview line improves inbox context and supports your final copy pass. |

## Activation safeguard

The flow itself is currently set to **Live**, but 26 email actions remain **Draft**. Turning on the flow alone will not make those drafts send. After your final content pass, each desired email action must be intentionally set to the intended action-level send status. That is a separate activation step and was not performed in this audit.

## Bottom line

The draft sequence is structurally clean: links are well formed, tracking is enabled, and footer handling is consistent. The remaining work is your deliberate final copy approval—especially time-sensitive offers, legacy discounts, and medical-claim wording—plus a decision on the live Day 0 footer before activation.
