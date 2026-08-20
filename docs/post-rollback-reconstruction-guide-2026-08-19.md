# Content Hub Post-Rollback Reconstruction Guide

**Purpose:** This guide records the local-only work that may disappear from the active workspace when the project is restored to checkpoint `374a59bf`. It is written so the work can be rebuilt deliberately after the rollback without guessing at architecture, routing, or protected funnel settings.

> **Rollback target:** `374a59bf` — the last clean published baseline shared by the managed project and GitHub `main`.
>
> **Do not reconstruct everything at once.** Rebuild one module at a time, test it, save a clean checkpoint, and only then proceed to the next module.

## What the Rollback Retains

The rollback retains all production code and configuration published through `374a59bf`, including the seven live Tantra video landing pages, their first-party attribution, Interconnected Meta campaign-identity capture, the current published Unbounce page, existing Klaviyo flows, and all database rows.

The following external items are also separate from this repository and should remain in place:

| External item | Expected status after rollback |
|---|---|
| Original Unbounce page | Unchanged: `https://try.theurbanmonk.com/interconnected-lp/` |
| Unbounce native test duplicate | Remains in Unbounce: `https://try.theurbanmonk.com/interconnected-lp-3` |
| Existing global Unbounce → Klaviyo integration | Remains configured to the Deep Sleep list for unrelated pages |
| Interconnected Klaviyo list | `Rrx44Q` — **Interconnected Free Screening Opt-Ins** |
| Interconnected Klaviyo flow | `YyFZPu` — `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` |
| New webhook secret | Stored in managed project secrets; never copy it into documentation or chat |
| Database migration effects | Existing database tables/columns are not removed by a code rollback |

## Reconstruction Order

1. Restore stable publishing and verify the `374a59bf` baseline.
2. Rebuild the native Unbounce page-specific receiver.
3. Configure and test the unpublished native Unbounce form.
4. Repair the legacy browser bridge only if the original Klaviyo embed remains in service.
5. Rebuild the ROAS benchmark calculator.
6. Resume the review-first Webinar Intelligence enhancement.
7. Apply the Kajabi raw-signature hardening only after its focused test is recreated.

## 1. Native Interconnected Unbounce Receiver

### Objective

Route submissions from **only** the unpublished native Unbounce test page to the correct Interconnected Klaviyo list and first-party attribution path, without changing the account-wide Deep Sleep Unbounce integration.

### Rebuild Prompt

> Build a page-specific server receiver for the unpublished native Unbounce Interconnected test form. Add a POST endpoint at `/api/interconnected/unbounce-native-lead`. It must accept Unbounce JSON and form-post-compatible payloads, require the secret header `x-urban-monk-webhook-secret`, and reject missing or incorrect secrets. It must accept submissions only when the payload page URL resolves to pathname `/interconnected-lp-3`; reject any other Unbounce page so Deep Sleep or unrelated pages cannot enter the Interconnected funnel. Require a valid email; treat phone as optional contact context and do not infer SMS marketing consent from the presence of a phone number. For accepted events, create exactly one first-party Interconnected lead using the KO/Klaviyo path, subscribe or update the profile in Klaviyo list `Rrx44Q` (Interconnected Free Screening Opt-Ins), and issue one deterministic server-side Meta Lead event for deduplication. Reuse existing first-party lead and CAPI helpers rather than creating a parallel schema. Add focused tests for: invalid secret, wrong page URL, missing email, correct `Rrx44Q` routing, optional phone storage, and duplicate-safe event ID generation. Do not change the original `/interconnected-lp/`, the global Deep Sleep Unbounce integration, any Meta pixel setting, or flow `YyFZPu`.

### Acceptance Checks

| Check | Required result |
|---|---|
| Invalid secret | HTTP 401 or 403; no lead, Klaviyo action, or CAPI event |
| Wrong Unbounce page | HTTP 400 or 403; no lead, Klaviyo action, or CAPI event |
| Email-only form submission | Accepted; phone remains empty; no SMS consent inferred |
| Correct test page | Profile is added to `Rrx44Q` only |
| First-party attribution | One lead record carries the KO/Klaviyo path and source-page metadata |
| Meta CAPI | One deterministic Lead event, with no browser/server duplication |

### Unbounce Test-Page Configuration After the Receiver Is Published

Use the native form on **only** `https://try.theurbanmonk.com/interconnected-lp-3`.

| Field or setting | Required configuration |
|---|---|
| Email field ID | `email` |
| Email required | Yes |
| Phone field ID | `phone` |
| Phone required | No |
| Name fields | Do not add them |
| Old Klaviyo embed | Remove `Custom HTML 2` from the **test duplicate only** once the native form is configured |
| Receiver URL | `https://content.theurbanmonk.com/api/interconnected/unbounce-native-lead` |
| Webhook content type | JSON |
| Header name | `x-urban-monk-webhook-secret` |
| Header value | The existing managed secret; enter it only in the Unbounce webhook custom-header UI |
| Global Deep Sleep integration | Leave unchanged |

### Controlled Test Gate

Before sending any traffic, submit one email-only controlled test and verify all four outcomes: a successful Unbounce lead/webhook delivery, a Klaviyo profile in `Rrx44Q`, the Day 0 trigger for `YyFZPu`, and exactly one Content Hub lead plus one CAPI Lead event. Publish the test page only after the receiver is live and this test is clean.

## 2. Legacy Unbounce Klaviyo Browser Bridge

### Objective

Keep this separate from the native-form project. It matters only if the original browser-embedded Klaviyo form remains in use.

### Rebuild Prompt

> Repair the existing Unbounce Klaviyo lead bridge so it accepts both the established JSON request body and the redirect-safe `navigator.sendBeacon` transport used by the published Unbounce script. The browser beacon may arrive as `text/plain` containing serialized JSON; parse that format safely and validate it against the same required event contract as JSON. Do not trigger duplicate Meta Lead events. Preserve the exact existing event-ID deduplication contract, optional phone behavior, list routing, and error-isolation rule: a bridge failure must not prevent a successful Klaviyo subscription. Add focused tests proving JSON and `text/plain` JSON create the same valid first-party record, while malformed text/plain payloads are rejected.

### Protected Settings

Do not switch `YyFZPu` to a different flow, activate any draft follow-up email, remove optional phone capture, or change pixels. The original page remains on hold until Chrome form rendering **and** a genuine browser form submission produce both Klaviyo and first-party bridge records.

## 3. Interconnected ROAS Benchmark Calculator

### Objective

Restore the team-facing calculator in the Interconnected Command Center without changing funnel conversion behavior or triggering automatic Meta API calls.

### Rebuild Prompt

> Add an `EntryPriceBenchmark` section to `client/src/pages/InterconnectedCommandCenter.tsx`. It must allow the operator to select an entry price of $49, $67, or $99; edit the assumed $199 OCUS take rate (default 15%); and edit verified CPL (default $2.40). Calculate revenue per lead as `entry price + ($199 × OCUS take rate)`. Display the required lead-to-entry conversion for break-even, 1.5x ROAS, and 2.0x ROAS using `target ROAS × CPL ÷ revenue per lead`. Make all assumptions visibly editable, label the values as scenario planning rather than measured performance, and do not initiate any Meta API request on page load or when inputs change. Keep Kajabi and KO/Klaviyo reporting separate and use first-party logic only.

### Acceptance Checks

| Check | Required result |
|---|---|
| Price selector | Offers $49, $67, and $99 |
| Default assumptions | $67 entry, 15% $199 OCUS rate, $2.40 CPL |
| Math | Updates immediately and visibly when any assumption changes |
| API guardrail | No Meta refresh occurs automatically |
| Reporting boundary | No pooling of Kajabi and KO/Klaviyo metrics |

## 4. Review-First Webinar Intelligence Synthesis

### Objective

Extend Avatar Intelligence with reviewable source syntheses, never silently changing the live avatar context.

### Rebuild Prompt

> Add a review-first synthesis workflow for Webinar Intelligence. Create an `avatar_synthesis_reviews` table with source metadata, response count, generated synthesis text, status (`pending`, `approved`, `rejected`), timestamps, and reviewer identity. Add a protected `pendingReviews` query. Add a `generateSynthesis` mutation that reads a selected imported Webinar/Typeform response set, calls the server-side LLM, and stores the output as `pending`; it must not update the live Avatar Intelligence context. Add an approval mutation that appends an approved source-labeled synthesis to the live Avatar Intelligence context and marks the review approved. Add reject behavior that keeps the live context unchanged. Build an Avatar Intelligence UI section called Pending Syntheses with source label, response count, synthesis text, Approve, and Reject controls. Apply the workflow to the three legacy 49-response payloads only after review controls are complete. Add focused tests. Do not automatically update live avatar context from any import.

### Protected Rule

No synthesis may alter the live Avatar Intelligence profile until the owner approves that individual review item.

## 5. Kajabi Buyer Webhook Raw-Signature Preservation

### Objective

Preserve raw request bytes before JSON parsing so future Kajabi buyer webhooks can pass HMAC verification and improve direct $67/$199 buyer attribution.

### Rebuild Prompt

> In the server entry, preserve the raw request body bytes for the Kajabi buyer webhook route before global JSON parsing changes the payload. Verify Kajabi signatures against the original raw bytes, not re-serialized JSON. Limit this change to the buyer webhook path. Add a regression test using a signed fixture that fails if the request is re-serialized before verification and passes when raw bytes are used. Do not backfill historical buyers, alter Kajabi funnel pages, change purchase offers, change pixels, or mix Kajabi and KO/Klaviyo revenue.

## 6. Supporting Documents and Assets

The recovery copy includes or should retain these local artifacts for reuse without reauthoring:

| Artifact | Purpose |
|---|---|
| `Curt_Interconnected_Meta_Attribution_Handoff_2026-08-17.docx` | Curt’s Agora URL macro and attribution handoff |
| `unbounce-klaviyo-chrome-embed-support-tickets-2026-08-17.md` | Support-ticket evidence and request language |
| `unbounce-klaviyo-interconnected-readiness-2026-08-17.md` | Launch-gate evidence log |
| `unbounce-native-form-klaviyo-architecture-research-2026-08-18.md` | Native-form research, configuration, and list-routing constraint |
| `audit-ocus-take-rate.mjs` | Read-only Kajabi OCUS take-rate audit utility |

## Rebuild Discipline

Each rebuilt module must follow this sequence:

1. Add the task to `todo.md` before implementation.
2. Make the smallest isolated code change.
3. Add focused tests and run them.
4. Verify the relevant production boundary without changing live traffic.
5. Save a clean checkpoint before beginning the next module.

The native Unbounce test page should remain unpublished until its page-specific receiver is deployed and the controlled email-only test proves the complete path.
