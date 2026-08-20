# Native Unbounce Form → Klaviyo Architecture Research

## Question

Can the Interconnected landing page use an Unbounce-native form to deliver leads to Klaviyo directly, avoiding the browser-rendered Klaviyo embed and unnecessary intermediary platforms?

## Verified Answer

**Yes.** Unbounce supports a native landing-page form, and Klaviyo documents an official Unbounce integration that uses an Unbounce server-side form-submit webhook to add leads to a selected Klaviyo list. This is not a Zapier workaround and does not require the Klaviyo onsite-form rendering script.

Klaviyo’s documented setup requires the native Unbounce email field ID to be exactly `email` in lowercase, installation of Klaviyo’s Unbounce integration, selection of the destination list, and a Klaviyo-generated webhook URL plus custom-header secret configured in Unbounce. Klaviyo records successful submissions as its `Filled Out Form` metric.

## Recommended Architecture

Use **one native Unbounce form** as the source of truth and send its completed submission to two systems independently:

1. **Unbounce → Klaviyo official webhook.** This is the CRM delivery path, configured entirely through the official integration.
2. **Unbounce → Content Hub server webhook.** This is the first-party attribution path. It records the lead, preserves page/variant data, sends one deduplicated CAPI Lead event, and supports the current reporting model.

These are **parallel server-to-server deliveries**, not a chained browser bridge. The browser should not need to load or submit a Klaviyo form script. The architecture therefore removes the known blocker-sensitive Klaviyo embed and the current client-side beacon dependency.

## Why Not Use Only Unbounce → Klaviyo?

The direct native Unbounce → Klaviyo connection is sufficient for CRM delivery, but it would remove the Content Hub’s first-party lead record and CAPI-deduplication path. That would weaken the owner-required authoritative reporting model. A parallel Unbounce → Content Hub webhook retains both systems without introducing Zapier or another intermediary.

## Verified Account-Level Integration Constraint

On August 19, 2026, the logged-in Klaviyo Unbounce integration was verified as already enabled. Its Settings screen states that **all new Unbounce leads who fill out a form are added to one selected Klaviyo list**. The account’s current selected list is **The Deep Sleep Solution**. Therefore, changing that integration’s list setting to `Rrx44Q` would reroute other Unbounce-page leads and is not a safe per-page Interconnected configuration.

The native Interconnected test must therefore use a **page-specific webhook or Content Hub server route** that recognizes the test page and submits only its leads to `Rrx44Q`. The existing global Klaviyo integration should remain unchanged.

## Prepared Unpublished Test Receiver

On August 19, 2026, the Content Hub workspace was prepared with a page- and secret-scoped receiver at `/api/interconnected/unbounce-native-lead`. It accepts the documented Unbounce JSON or form-post payload format only when all of the following are true:

1. The request includes the matching `x-urban-monk-webhook-secret` custom header.
2. The Unbounce `page_url` is the unpublished native-form test path `/interconnected-lp-3`.
3. The payload contains a valid email address.

For accepted submissions, the receiver writes an isolated `ko_klaviyo` first-party Interconnected lead, adds the profile to `Rrx44Q`, and sends one deterministic server-side Meta Lead event. Phone is stored as contact context only; the receiver does not infer SMS marketing consent.

The intended Klaviyo automation was independently verified in the logged-in flow editor: flow `YyFZPu`, `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67`, triggers when a profile is **Subscribed to List** and that list equals **Interconnected Free Screening Opt-Ins** (`Rrx44Q`). Its existing Day 0 email remains Live; its draft follow-up messages were not changed.

The focused security and list-routing tests pass. The receiver cannot be exposed to Unbounce until the separate Content Hub project-history publication issue is repaired. No webhook has been added to the test page yet, no Unbounce page has been published, and the global Deep Sleep integration remains unchanged.

## Form and Data Contract

| Item | Required configuration |
|---|---|
| Email | Native Unbounce field ID exactly `email`; required |
| Phone | Native field ID `phone`; optional |
| SMS consent | Separate explicit consent control; do not infer SMS marketing consent merely from a phone number |
| CRM destination | Klaviyo list `Rrx44Q` — Interconnected Free Screening Opt-Ins |
| Attribution | Preserve Unbounce page URL, page UUID, page name, variant, submission time, and UTM/click values where available |
| CAPI | Content Hub webhook creates one deterministic event ID and sends one server-side Lead event |
| Security | Restrict the Content Hub webhook to documented Unbounce source IPs and add a shared secret if supported by the Unbounce webhook configuration |

## Validation Gate Before Any Cutover

1. Build the native form only on an unpublished test version or duplicate.
2. Confirm email-only submission works while phone and SMS consent remain blank.
3. Confirm the Unbounce Leads table shows a successful native submission and green integration status.
4. Confirm the Klaviyo profile, list membership, and `Filled Out Form` event.
5. Confirm exactly one first-party Content Hub lead record and one CAPI event with the same deterministic event ID.
6. Retest with a standard Chrome profile and a content-blocking profile.
7. Only after all checks pass, obtain explicit owner approval for the public conversion-path switch.

## Sources

1. Klaviyo, *Getting started with Unbounce*, updated November 18, 2025: https://help.klaviyo.com/hc/en-us/articles/115005082507
2. Unbounce, *How to Integrate with Klaviyo*, updated July 26, 2023: https://documentation.unbounce.com/hc/en-us/articles/4401928869012-How-to-Integrate-with-Klaviyo
3. Unbounce, *Using a Webhook*, updated February 6, 2026: https://documentation.unbounce.com/hc/en-us/articles/203510044-Using-a-Webhook
4. Unbounce, *Adding and Editing Forms in the Classic Builder*, updated July 8, 2026: https://documentation.unbounce.com/hc/en-us/articles/203799174-Adding-and-Editing-Forms-in-the-Classic-Builder
