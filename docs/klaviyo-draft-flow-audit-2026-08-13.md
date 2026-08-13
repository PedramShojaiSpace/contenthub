# Klaviyo Draft-Flow Audit — 2026-08-13

## Initial authenticated canvas review

The browser is authenticated and shows the flow titled **`[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67`** (flow ID `YyFZPu`). The flow-level control currently displays **Live**. At the visible top of the canvas, `Day 0 opt in EG sp26` is also explicitly marked **Live** and carries the visible subject line, **“Your spot is confirmed. Here's what happens next.”**

At the top of the visible canvas, the primary trigger is **When someone Subscribed to List**. Two first-message blocks are visible:

| Visible message | Canvas status | Initial interpretation |
|---|---:|---|
| `Day 0 opt in EG sp26` | Live | A green live message appears in the review flow. It is the only message visibly confirmed live at the initial canvas position and needs explicit launch-path verification. |
| `Day - 0` | Draft | This is a **text message**, not an email. It requires SMS copy and link review before later activation. |

The visible second message, `Day - 0`, has the preview copy **“Welcome to the Interconnected Series! You'll get links to each episode daily as they become available.”** and is marked **Draft**. Its inspected text-message settings show **Smart Sending**, **UTM tracking**, and **quiet hours** enabled. The individual-message panel is explicit that this action is a **Text message** and has no performance yet.

The next visible message is also an SMS action: `Day - 1`, marked **Draft**, with the copy **“Episode 1 of Interconnected is now available - click here to see it now:”** followed by the direct episode URL. It needs link-destination and copy review alongside the other draft SMS messages.

The first email action, `Day 0 opt in EG sp26`, was individually inspected. It is **Live**, has subject **“Your spot is confirmed. Here's what happens next.”**, sender **Interconnected Series by The Urban Monk**, sender address **Support@theurbanmonk.com**, UTM tracking enabled, and Smart Sending set to skip profiles emailed within the prior 16 hours. Its preview-text field is blank. No send test, proofreading approval, or optimizer backup record was confirmed in this visual inspection.

## Content Hub optimizer review

The Content Hub’s **Klaviyo Flow Optimizer** lists the review flow as **`[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67 · live`**. The tool is designed to calculate the same HTML cleanup and copy review before any write; an explicit **Apply with backup** action is required for each supported CODE-template email.

The visible restore-point history contains only **Tantra Quiz — 5-Day Sequence** records. There is no displayed Interconnected backup/apply record. Therefore, the current review flow cannot be represented as having already been passed through the newly enhanced optimizer; that review must be deliberately completed before activation.

The next visible action after that draft email is **Wait 1 day**, configured for **9:00 AM**. This confirms the draft flow uses a sequenced daily cadence rather than a second immediate message.

Klaviyo's built-in **Audit flow** feature was opened in read-only review mode for flow `YyFZPu`. The prefilled audit request is processing at the time of this note; no message status, flow setting, recipient, or sending action was changed.

Klaviyo reports that the flow was not already in its audit cache and is reviewing it in the background. No audit recommendations had returned as of the next browser check; its audit assistant reports that the audit continues in the background.

The audit panel was closed without making changes. The canvas now offers **View audit**, but no recommendation summary is visible on the canvas itself yet.

This is an initial visual finding only. The remaining canvas must be reviewed to establish the full message count, each message status, subjects, rendering, tracked links, and sending path before a traffic recommendation is made.
