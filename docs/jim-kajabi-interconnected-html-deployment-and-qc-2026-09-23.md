# Jim’s Kajabi Deployment Guide: Interconnected $67 Buyer Emails

**Prepared for:** Jim, Urban Monk VA  
**Prepared:** 23 September 2026  
**Purpose:** Load the approved, Content-Hub-optimized HTML into the existing **draft** buyer sequence for review. **Do not activate, enroll anyone, or attach an offer trigger during this task.**

---

## What is already in place

Kajabi already grants a $67 purchaser access to the **Interconnected Series Self Guided** product at the moment of purchase. The part that is unfinished is the buyer-email sequence.

The draft sequence exists in Kajabi with all ten positions, but it has **0 subscribers, 0 subscribe triggers, and 0 sent emails**. It is safe to work in because it cannot currently send to buyers.

> **Work only in this draft:** [DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99  
> Direct Kajabi link: `https://app.kajabi.com/admin/email_sequences/2148891667`

Do **not** work in the existing free-screening / lead-nurture flow. Do **not** create a new sequence. Do **not** press any control that says Subscribe, Add Subscribe Trigger, Publish, Activate, or Send to All.

---

## What Jim needs before starting

1. A desktop browser with Kajabi login access to **The Urban Monk Academy**.
2. The attached ZIP package named `jim-kajabi-interconnected-html-deployment-packet-2026-09-23.zip` downloaded and unzipped to the desktop.
3. A plain-text editor such as TextEdit in **plain text mode**, Notepad, VS Code, or Sublime Text. Do **not** open the HTML files in Word, Pages, Google Docs, or an email application; those tools can alter quotation marks and HTML.
4. One internal review email inbox available for test sends. This should be a real internal inbox, not a buyer address.
5. About 45–60 uninterrupted minutes. The safest pace is to complete **one email completely**—paste, save, reopen, verify—before opening the next email.

---

## Non-negotiable safeguards

| Do | Do not |
|---|---|
| Work only in the named **[DRAFT]** sequence. | Do not attach a subscriber trigger or an offer-purchased automation. |
| Paste only the supplied HTML **fragment** into the main body/text block. | Do not paste an HTML file into the subject line, preview line, header, footer, or the entire template source. |
| Preserve Kajabi’s existing footer and unsubscribe controls. | Do not delete the physical address, unsubscribe link, sender identity, or compliance footer. |
| Save after every individual message. | Do not make a batch of unsaved changes. |
| Preserve unresolved `{{TOKEN}}` text exactly if it appears in the supplied HTML. | Do not invent URLs, use a placeholder `#`, or send a buyer-facing test with raw tokens. |
| Stop and record a screenshot if a save does not confirm. | Do not repeatedly click through a blank/extension page or overwrite a body you cannot verify. |

---

## The ten messages to load

All HTML files below are inside the ZIP in the `html/` folder. The sequence timing is already set in Kajabi. **Do not change timing during this HTML-loading task.** Kajabi displays timing in Pacific Time; 8:00 AM PDT is 10:00 AM Central during daylight-saving time.

| # | Kajabi internal title | Kajabi schedule | HTML filename | Subject already in Kajabi |
|---|---|---|---|---|
| 1 | `01 - Access Delivery (transactional review)` | Immediately / Day 0 | `01-access-delivery-transactional.html` | Your Interconnected protocol is ready |
| 2 | `02 - $199 Recovery` | Day 1, 8:00 AM PDT | `02-199-member-offer-recovery-delayed.html` | One optional next step, if you want to go deeper |
| 3 | `03 - Day 1 Orientation` | Day 1, 9:00 AM PDT | `03-day-1-paid-orientation.html` | Start here (not everywhere) |
| 4 | `04 - Day 3 Series Activation` | Day 3, 8:00 AM PDT | `04-day-3-series-activation.html` | Watch less, notice more |
| 5 | `05 - Day 6 Protocol Activation` | Day 6, 8:00 AM PDT | `05-day-6-protocol-activation.html` | Your 30-day reset — one step, not fifty |
| 6 | `06 - Day 9 Testing Education` | Day 9, 8:00 AM PDT | `06-day-9-testing-education.html` | The foods working against you (you can't see them) |
| 7 | `07 - Day 13 Live Education` | Day 13, 8:00 AM PDT | `07-day-13-live-education.html` | Bring your questions to a live session |
| 8 | `08 - Day 17 Decision Support` | Day 17, 8:00 AM PDT | `08-day-17-decision-support.html` | Three honest paths from here |
| 9 | `09 - Day 24 Re-engagement` | Day 24, 8:00 AM PDT | `09-day-24-reengagement.html` | One small change, protected |
| 10 | `10 - Day 30 Progress Review & Handoff` | Day 30, 8:00 AM PDT | `10-day-30-progress-review-handoff.html` | A month in — look back before you look forward |

> **Important correction for review:** Message 2 is currently titled **$199 Recovery**, but the active commercial strategy is now a $99 Upstream Course OCU. Load the supplied HTML into the draft only; **do not activate Message 2** until its offer, price, and suppression logic are formally revised and approved.

---

## Exact procedure: load one email

Repeat this exact procedure for each of the ten rows above.

### 1. Open the correct message

1. Go to `https://app.kajabi.com/admin/email_sequences/2148891667`.
2. Find the message by its internal title in the table above.
3. Click the message title or **Edit**. Confirm the internal title, day, subject, and preview text match the table before changing anything.
4. Open the matching `.html` file from the ZIP with a **plain-text editor**.
5. Select all of the file contents and copy them. Do not copy only the visible text in a browser preview; copy the actual HTML source.

### 2. Open only the main email body

1. On the Kajabi message-edit screen, click **Edit content** or **Launch Email Editor**.
2. In the editor, select the main, largest text/content section. Depending on the template, it may be labeled **Text**, **Content**, **Main text**, or contain the email’s long paragraph copy.
3. Do **not** select the logo/header, footer, social icons, legal block, global settings, or a reusable footer section.
4. In that main text section, open the HTML/source-code control. Kajabi may show it as **`</>`**, **Source**, **Edit HTML**, or a similar advanced-text control.

### 3. Replace the body safely

1. Click inside the **main content’s source-code field**.
2. Press `Ctrl+A` (Windows) or `Command+A` (Mac) **while the cursor is inside that field**.
3. Paste the full matching HTML fragment from the package.
4. Confirm that the pasted content begins with normal HTML such as `<p>` or `<div>` and does **not** contain a second document wrapper such as `<html>`, `<head>`, or `<body>`.
5. Click the source editor’s **Apply**, **Done**, or checkmark control.
6. Save the **content block / editor**.
7. Return to the normal Kajabi email edit screen and click the page-level **Save** button.
8. Wait for Kajabi’s save confirmation before navigating away.

### 4. Reopen and verify the same message

1. Return to the sequence list.
2. Reopen the same message.
3. Confirm the internal title, day, subject, and preview text are still correct.
4. Click **Edit content** again and verify that the visible body is the intended message—not the old template text, duplicate text, a blank section, or raw HTML tags.
5. Record the result in the deployment log below before moving to the next email.

---

## If Kajabi becomes blank, blocked, or opens an extension page

The previous automated attempt encountered browser/editor instability. Jim should use this recovery procedure rather than fighting Kajabi:

1. **Stop clicking.** Take a screenshot of the state if possible.
2. Return directly to the sequence URL: `https://app.kajabi.com/admin/email_sequences/2148891667`.
3. Open the same email again from the sequence list.
4. Check whether the new body is present. If it is present, continue. If it is not present, repeat the paste process once.
5. If a message cannot be saved after one careful retry, mark it **BLOCKED**, record the email number and screenshot, then move on to the next message. Do not overwrite another message to compensate.
6. Do not use the browser Back button while the editor has unsaved changes; return through Kajabi’s own sequence breadcrumb or direct sequence URL after saving.

---

## Destination/token worksheet — required before buyer-facing activation

The current canonical HTML intentionally preserves unresolved destinations. A raw `{{TOKEN}}` must never reach a buyer.

| Token | Safe status today | Allowed action for Jim during staging | Required before activation |
|---|---|---|---|
| `{{PAID_LIBRARY_URL}}` | Verified | May replace with `https://theacademy.theurbanmonk.com/library` | Click-test while logged out and as a buyer if possible. |
| `{{PAID_EPISODE_1_URL}}` | Verified | May replace with `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | Verify an entitled buyer reaches the course after sign-in. |
| `{{PAID_SERIES_CONTINUE_URL}}` | Verified | May replace with `https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided` | Verify buyer access after sign-in. |
| `{{TESTING_MEMBER_OFFER_URL}}` | Strategy changed | **Leave unresolved.** The sequence’s old $199 testing path conflicts with the new $99 Upstream OCU direction. | Owner must provide the approved current offer/checkout destination and revised copy. |
| `{{STARTER_PROTOCOL_URL}}` | Not published | **Leave unresolved.** | Publish the Gut Restoration Protocol and supply its buyer-accessible URL, or remove the promise from the copy. |
| `{{NEXT_WEBINAR_OR_EVERGREEN_URL}}` | Not supplied | **Leave unresolved.** | Owner must provide the current webinar registration or evergreen replay URL. |
| `{{BUYER_NEXT_STEP_HUB_URL}}` | Not supplied | **Leave unresolved.** | Owner must choose or create the buyer next-step hub. |

> **Do not substitute the free screening page** at `interconnected.theurbanmonk.com/episode1` for a paid-buyer destination. It is gated by screening-email access and is not a reliable paid-buyer course link.

---

## Deployment log Jim should complete

Copy this table into a note, spreadsheet, or email to the owner. One row per message.

| # | HTML loaded | Kajabi save confirmed | Body re-opened and verified | Test sent | Test received | Raw token remains | Status / issue |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |

---

## Required QA before turning any automation on

### A. HTML and rendering checks

- [ ] All ten messages show the intended body copy after reopening Kajabi.
- [ ] No message shows old template copy, duplicate body copy, blank space, raw `<p>` tags, raw HTML, or broken formatting.
- [ ] Header/logo, typography, CTA styling, footer, physical address, and unsubscribe controls still appear.
- [ ] Each message is reviewed in Kajabi preview at desktop and mobile width.
- [ ] At least one internal test email is received for each final, link-complete message.
- [ ] The received test renders correctly in both Gmail and an iPhone/Android mail client if available.
- [ ] Every CTA is clickable and opens the intended destination.
- [ ] No raw `{{TOKEN}}`, `#`, temporary link, draft route, or free-screening gate remains in buyer-facing HTML.

### B. Offer and entitlement checks

- [ ] The $67 offer is published and still includes **Interconnected Series Self Guided**.
- [ ] A test buyer with the $67 entitlement can reach the product after sign-in.
- [ ] The exact buyer-entry rule is documented: the $67 Kajabi offer is `2151314475`.
- [ ] The legacy $99 front-end price-test offer (`2151402817`) is included **only if the owner explicitly wants it to enter the same buyer sequence**.
- [ ] The $99 **Upstream OCU** (`2151104453`) is treated as an upsell event, not as a second base-buyer entry that would restart the sequence.
- [ ] The new $99 Upstream OCU and the $199 testing offer have finalized buyer-facing recovery rules; the old $199 recovery email is not enabled by accident.

### C. Flow and consent checks

- [ ] The draft still shows **0 subscribers** until the owner approves activation.
- [ ] The draft still shows **0 subscribe triggers** until the owner approves activation.
- [ ] No existing free-screening or lead-nurture subscriber is added to this buyer sequence merely for opting in.
- [ ] A paid buyer will exit or be suppressed from the free screening / lead nurture at the approved handoff point.
- [ ] Email 1 is assigned to a true purchase-fulfillment mechanism, not assumed to be deliverable through a marketing-only sequence regardless of consent.
- [ ] The final long-term decision is explicit: Kajabi sends the entire buyer lifecycle **or** the confirmed Kajabi purchase pushes the buyer into the dedicated Klaviyo lifecycle. Do not run both versions simultaneously.
- [ ] No SMS is added without explicit SMS consent.
- [ ] A repeat buyer cannot be re-enrolled and receive Day 0/Day 1 messages again.

### D. Final activation gate

The owner must review and approve all of the following before a VA turns on any subscriber trigger or adds people to the flow:

1. The final HTML/test emails.
2. The finalized URL/token worksheet.
3. The decision on the $99 Upstream Course versus $199 testing recovery path.
4. The purchase-entry rule and duplicate-prevention rule.
5. The transactional-access delivery mechanism.
6. A single controlled test buyer journey.

---

## What Jim should report when finished

Send the owner a short message such as:

> “The 10 HTML bodies are loaded into the **[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99** sequence and saved. The sequence remains at 0 subscribers and 0 subscribe triggers. Messages [list numbers] passed body/preview testing. Messages [list numbers] still require URL or offer decisions. No trigger or enrollment has been activated.”

That report gives the owner a safe review point before the flow is connected to a real purchaser.

## References

[1]: https://app.kajabi.com/admin/email_sequences/2148891667 "Kajabi draft Interconnected Paid Buyer Lifecycle sequence"

[2]: https://app.kajabi.com/admin/offers/2151314475/edit "Kajabi Interconnected $67 Bundle OTO offer"
