# Interconnected Klaviyo Traffic-Readiness Procedure

## Decision

**Do not direct new traffic into the Klaviyo path yet.** The review flow is currently live and its first email action is also live, but the enhanced optimizer has not been confirmed across the Interconnected sequence. The correct approach is a controlled review, seed-test, and explicit launch decision—not a blind bulk rewrite.

> The Email Optimizer removes avoidable template signals. It cannot promise that Gmail will put any message into Primary, because mailbox placement remains recipient-specific.

## What is confirmed today

| Area | Confirmed state | Launch implication |
|---|---|---|
| Review flow | `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` (`YyFZPu`) is **Live** | Treat as a sending-capable flow until its status/trigger path is deliberately controlled. |
| First email | `Day 0 opt in EG sp26` is **Live** | Subject and sender are populated, but its preview text is blank and no seed test was confirmed. |
| Sender | `Interconnected Series by The Urban Monk` / `support@theurbanmonk.com` | Matches the intended sender identity. |
| Day-0 SMS | `Day - 0` is **Draft** | It has Smart Sending, UTM tracking, and quiet hours enabled; it needs manual SMS copy/link review. |
| Day-1 SMS | `Day - 1` is **Draft** | It uses an episode URL and needs a link-destination check. |
| Optimizer history | No Interconnected apply/backup record is visible in the Content Hub’s restore history | Do **not** claim that the 27-email sequence has passed through the enhanced optimizer. |

## Required workflow for every email

The VA should use the Content Hub at `https://content.theurbanmonk.com/klaviyo-flow-optimizer`. The tool reads the selected flow, compares the original and reviewed HTML, and writes only after an explicit **Apply with backup** confirmation. It stores a restore point first. Direct application is intentionally limited to **CODE** templates; drag-and-drop templates remain review-only.

| Step | VA action | Pass criterion |
|---|---|---|
| 1. Freeze the launch path | Keep traffic off the Klaviyo thank-you treatment. Before any live test, the owner must decide whether to set `YyFZPu` itself to Draft. | No unintentional subscriber can enter the review flow. |
| 2. Select the exact flow | In **Klaviyo Flow Optimizer**, select `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67`. | The page identifies the correct flow by name and status. |
| 3. Inspect, do not apply blindly | Open **Review** for each supported email. Check the original HTML, optimized HTML, promotional-signal warnings, copy review, subject line, sender, preview text, unsubscribe/preference mechanism, and destination of every CTA. | A reviewer initials each email in the review log. |
| 4. Apply only approved CODE-email changes | For an approved CODE template, use **Apply with backup**. Do not apply any change to a drag-and-drop template through this tool. | A Content Hub restore point appears for that exact Interconnected template. |
| 5. Review SMS separately | In Klaviyo, open every draft text message. Confirm the copy, the tracked destination URL, quiet-hours setting, and consent logic. | Each SMS remains Draft until its copy and link have been checked. |
| 6. Fix sender metadata | Add meaningful preview text to Day 0; keep sender name and address consistent. | Sender, subject, and preview text read naturally in the inbox. |

## Seed-test procedure

Use this test sequence after the review work—not before it.

1. In each Klaviyo email editor, use its preview/test-send function to send the exact message to the owner’s Gmail seed address and, where available, a second clean Gmail test address. Do not use a production subscriber as a test profile.
2. In Gmail, check the **actual received message** on desktop and mobile. Verify the From line, subject, preview text, body spacing, unsubscribe link, every CTA destination, UTM parameters, and the $67 offer link where intended.
3. Record the Gmail tab as **Primary**, **Promotions**, **Spam**, or **Missing**. If it lands in Promotions, retain the screenshot/header evidence but do not claim that a formatting change alone will force Primary.
4. Send the next seed test only after the current message has passed editorial review. For the daily sequence, verify the first email, the first episode email, a representative middle email, the final email, and every unique offer/CTA pattern. If the owner requires every one of the 27 emails to be individually proofread, the VA should open and sign off every one before the launch decision.
5. Test the draft SMS sequence on a real consented internal test number only after the owner confirms that message delivery is permitted. Confirm quiet hours and the episode/offer links.

## Go / no-go gate

Traffic may be sent only after all rows below are green.

| Gate | Owner | Required evidence |
|---|---|---|
| Sending safety | Owner | Explicit decision on the current live review flow and the intended traffic path. |
| Email inventory | VA | Every sequence email is identified, proofread, and assigned a final Draft/Live status. |
| HTML review | VA + owner | Each CODE email has either an approved backup record or a recorded reason no change was needed. |
| Link verification | VA | Every $67, episode, checkout, unsubscribe, and preference link opens the intended destination. |
| Seed evidence | Owner | Received seed copies and inbox-tab observations for the agreed test set. |
| SMS safety | VA + owner | SMS remain Draft until their copy, consent, quiet hours, and links are approved. |
| Final activation | Owner | Explicit written approval to make the approved messages and intended sending path live. |

## Recommended immediate next action

The next safe action is **not** to send traffic. First, decide whether the review flow should be set to Draft to remove accidental-send risk. Once that is settled, I can use the Content Hub to generate the full Interconnected email review inventory and then provide the VA a message-by-message checklist.

## References

[1] [Klaviyo, “Get Actions for Flow”](https://developers.klaviyo.com/en/reference/get_actions_for_flow) — the flow-action inventory endpoint is read-only and supports retrieving associated action data.

[2] [Klaviyo, “Get Messages for Flow Action”](https://developers.klaviyo.com/en/reference/get_flow_action_messages) — Klaviyo documents flow-message retrieval as a distinct resource from the flow action.
