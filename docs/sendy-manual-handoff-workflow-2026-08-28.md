# Sendy Draft-Only Workflow

## Team Bookmark

Open the Email Optimizer directly at:

`https://content.theurbanmonk.com/hub/content/email-optimizer?tab=sendy`

The bookmark opens directly on the **Sendy Handoff** tab. It is now connected to the Urban Monk Sendy installation for **read-only brand/list discovery and draft creation only**. It cannot schedule or send a campaign, and it does not store Amazon SES credentials.

## How to Use It

| Step | Team action |
|---|---|
| 1 | Optimize the email in the existing **Single Email**, **Bulk Sequence Optimizer**, or Kajabi bookmarklet workflow. |
| 2 | Open **Sendy Handoff** and select **Use Latest Optimized HTML**, or paste the already approved optimized HTML. |
| 3 | Select the Sendy brand, then add the campaign title, subject, approved sender, reply-to, and planned Sendy audience description. |
| 4 | Paste the optimized HTML or select **Use Latest Optimized HTML**. The tool generates a plain-text companion. **Copy Backup Handoff** and **Download Backup Handoff** remain available for team records. |
| 5 | Review the draft-only safeguard, check the acknowledgement box, and click **Create Sendy Draft**. The Content Hub explicitly passes Sendy `send_campaign=0`; it does not include schedule details or recipient list IDs. |
| 6 | In Sendy, review the new draft. Confirm list/segment, exclusions, sender identity, unsubscribe/preferences handling, links, and mobile/desktop preview. Send a test from Sendy before any separate approval to schedule or deliver the campaign. |

## Boundaries

The Content Hub uses its protected server-side Sendy connection for brand/list discovery and draft creation. It does not expose the API key in the browser, hold Amazon SES credentials, create subscribers, select or send to campaign recipients, schedule campaigns, or send email. Sendy remains the source of truth for list choice, suppression, unsubscribe handling, test delivery, send timing, and delivery configuration.

Live preview verification confirmed that the authenticated Sendy brand selector returns **The Urban Monk**. The current workflow is deliberately draft-only and must not enable live send without a separate approval and additional delivery safeguards.

## Validation Record

The Sendy connection was validated with a read-only brands call, which returned the Urban Monk brand. The same read-only list discovery call returned **“No lists found”** for that brand, so the interface now informs the team to create or confirm the approved Sendy audience before any test delivery, scheduling, or send.

With the owner’s direct approval, the system created two identically labeled unsent validation drafts while the one-time integration test and subsequent safety-suite test were run during setup:

`TEST — Content Hub Sendy Draft Validation — Do Not Send`

Both drafts contain only the minimal test message, no recipients, no list or segment IDs, no schedule, disabled open/click tracking, and Sendy `send_campaign=0`. They were not sent. The Sendy team may retain one as a reference and delete the duplicate; no further automated test run will create a draft unless the explicit mutation-test setting is deliberately enabled.
