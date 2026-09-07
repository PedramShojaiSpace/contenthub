# Klaviyo Flow `YyFZPu` — Read-Only Design Audit Observations

**Audit date:** 2026-09-07  
**Scope:** Read-only verification of whether the owner-edited flow messages carry the approved light Interconnected visual style. No message, flow, list, consent state, subscriber record, or send setting was changed.

## Confirmed canvas state

The linked flow is titled **`[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67`**. The visible canvas shows a subscription-to-list trigger and two Day 0 email actions. Despite the label containing “DRAFT,” both visible email actions displayed a **Live** status in the Klaviyo canvas at the time of inspection.

| Canvas element | Read-only observation |
|---|---|
| Trigger | “When someone Subscribed to List”; visible list label: `Day 0 opt in EG sp26` |
| First email | `Day 0 opt in EG sp26`; action ID `114441634`; summary “Your spot is confirmed. Here's what happens next.”; Live |
| Second email | `Day - 0`; summary begins “Welcome to the Interconnected Series!”; Live |
| Observed second-email summary | It includes a Shopify Interconnected product link and a “Special Pricing Today Only” message in the canvas excerpt. |

## Current limitation

The first email action was opened through the canvas for a read-only template inspection, but the browser artifact collector encountered a Chrome-extension context and could not display the message editor. As a result, the specific color values, button styling, header/background blocks, typography, and footer of the edited email have **not yet been confirmed**. This is a visual-inspection limitation, not evidence that the current edits are wrong.

A later direct action inspection did load the first email’s details panel. It confirmed that `Day 0 opt in EG sp26` is **Live**, has action ID `114441634`, uses the sender name **Interconnected Series by The Urban Monk** and sender address `Support@theurbanmonk.com`, and showed an open rate of **58.8% (10)** and click rate of **17.6% (3)** over the last 30 days. These are descriptive dashboard metrics only; they do not validate message design or prove conversion. An attempt to open the card’s action menu for the preview/editor entry timed out, so template-color and block-level inspection remains incomplete.

## Owner-approved visual-only change — execution baseline

The owner explicitly approved the following visual-only change for both live Day 0 emails in flow `YyFZPu`: white canvas (`#FFFFFF`), dark blue-green header (`#062B38`), charcoal reading copy (`#233840`), one cyan-teal primary CTA (`#087E9D`) with white label, and pale blue-green divider (`#CFE3E5`). The first email detail panel confirms the **Live** state, its existing sender identity, its original subject line, and enabled UTM tracking. These nonvisual settings, along with copy, CTA destinations, timing, Smart Sending, quiet hours, SMS/consent, and flow structure must remain unchanged.

## Official API feasibility finding — read-only only

Klaviyo’s official Flow Message API can retrieve a flow message using its action ID and includes the flow message’s template reference when requested. The current Templates API can retrieve native drag-and-drop template definitions and lists `templates:read` / `templates:write` as the relevant scopes. However, the legacy update-template endpoint explicitly states that it cannot update drag-and-drop templates. Before using any API write path, the exact template IDs and their reuse relationship must be read first: an in-place change to a shared template could affect messages outside this flow. The current browser template-editor click is blocked by a browser-extension context, so no API write has been attempted. Sources: https://developers.klaviyo.com/en/reference/get_flow_message ; https://developers.klaviyo.com/en/reference/templates_api_overview ; https://developers.klaviyo.com/en/v1-2/reference/update-template.

### Current API endpoint clarification

Klaviyo’s current API exposes `GET /api/flow-actions/{id}/flow-messages` for obtaining the real flow-message IDs tied to a browser-visible action ID; an attempted direct call to `/api/flow-messages/114441634` correctly failed because `114441634` is an action ID, not a flow-message ID. The current `PATCH /api/templates/{id}` reference documents `templates:write` and accepts native drag-and-drop template definition updates. Any future write must still first identify the exact message → template relationship and prove that the template is not shared outside the two owner-approved Day 0 emails. Sources: https://developers.klaviyo.com/en/reference/get_flow_action_messages ; https://developers.klaviyo.com/en/reference/update_template.

## Required next verification

Before stating that the design is attached, inspect each live email’s template preview or editor and compare it with the approved reference at `docs/interconnected-klaviyo-email-style-reference-2026-09-07.md`:

1. Dark blue-green header `#062B38`.
2. White reading canvas with charcoal body copy `#233840`.
3. One cyan-teal primary CTA `#087E9D` with white button text.
4. Pale blue-green divider `#CFE3E5`.
5. Approximately 600 px single-column layout and a readable image-blocked state.
6. Standard Klaviyo unsubscribe/footer block retained.

No send, publish, subscriber, consent, CTA-destination, or status action is approved as part of this inspection.

## Completed owner-approved email-only update

The owner subsequently approved a dedicated email-template duplication and visual-only restyle for the first Day 0 email. Supported Klaviyo API reads established that the companion Day 0 action (`114441635`, message `W9f5Gn`) is a `send-sms` action rather than an email; it was explicitly excluded and remained live and unchanged.

The shared source code template `VkePBa` was cloned rather than edited in place. Klaviyo returned the final dedicated attached template as `VPivUR`, named **`[INTERCONNECTED] Day 0 — Light Teal Email — Dedicated`**. A post-update API read confirmed that it contains the approved white/light canvas, `#062B38` header, `#233840` body copy, `#087E9D` primary CTA, `#CFE3E5` divider, and 600 px content-card treatment. It also confirmed that the rendered HTML CTA and the plain-text fallback both use `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`.

The same post-update read confirmed the live first email action remains `114441634` / `SypiFq`, with the prior sender, sender label, reply-to address, subject, preview text, Smart Sending state, transactional setting, UTM tracking setting, flow status, and downstream action link preserved. No message was sent or scheduled, and no flow structure, list state, consent/SMS configuration, checkout setting, or delivery setting changed.
