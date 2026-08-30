# Meta Apollo Custom Audiences: Manual Build and API Review Transition

**Status:** Owner-selected two-track plan. This document prepares a manually controlled initial build and the later API-access review. It does **not** create a Custom Audience, generate a contact-list file, upload customer information, create an ad, change an ad budget, send a message, or enable a scheduled process.

## Decision and boundary

The owner selected **A + B**: create the initial nine approved Custom Audiences manually in the Meta interface now, then continue manually updating them until Meta grants the application access required for the controlled daily category-specific sync. The existing `Urban Monk Lead Scraper – Health Intent Leads` audience remains untouched. No generic fallback audience is permitted.

The records are limited to exclusive, normalized, verified business-email cohorts from the approved Apollo workflow. The audience definitions describe professional roles, not an individual's health status, medical condition, testing history, treatment, or other sensitive information. All use remains subject to Meta’s Customer List Custom Audience Terms and the owner’s confirmed authority and appropriate basis for matching.

> Meta’s published guidance states that a customer-list audience must not be named, include, or be based on prohibited information, including health information. It also requires the advertiser to have the necessary rights, permissions, and lawful basis for the uploaded customer information.[1] [2]

## Confirmed batch definition

The counts below were re-queried from the current database on 2026-08-30 without retrieving or displaying a single email address. Each person is assigned to only one category after normalized-email deduplication, using the approved category priority order.

| # | Exact Meta audience name | Cohort category | Verified exclusive email rows | Manual list column | Intended list source |
|---:|---|---|---:|---|---|
| 1 | `UM Apollo — Medical Doctors` | `medical_doctor` | 989 | `email` | Apollo-sourced partner/data-provider business contacts |
| 2 | `UM Apollo — Dentists` | `dentist` | 854 | `email` | Apollo-sourced partner/data-provider business contacts |
| 3 | `UM Apollo — Functional Medicine` | `functional_med` | 352 | `email` | Apollo-sourced partner/data-provider business contacts |
| 4 | `UM Apollo — Nutrition Professionals` | `nutritionist` | 644 | `email` | Apollo-sourced partner/data-provider business contacts |
| 5 | `UM Apollo — Nurses & NPs` | `nurse` | 724 | `email` | Apollo-sourced partner/data-provider business contacts |
| 6 | `UM Apollo — Longevity Professionals` | `biohacker` | 921 | `email` | Apollo-sourced partner/data-provider business contacts |
| 7 | `UM Apollo — Wellness Coaches` | `wellness_coach` | 482 | `email` | Apollo-sourced partner/data-provider business contacts |
| 8 | `UM Apollo — Resilience & Workplace Wellbeing Professionals` | `burnout` | 490 | `email` | Apollo-sourced partner/data-provider business contacts |
| 9 | `UM Apollo — Meditation & Yoga Professionals` | `meditation_teacher` | 424 | `email` | Apollo-sourced partner/data-provider business contacts |
|  | **Total** |  | **5,880** |  |  |

The files must contain only the single `email` column and the approved verified business-email values for that exact cohort. Do not add names, employer, title, health-related fields, customer value, phone numbers, IDs, or notes. Do not add records to make the lists larger.

Meta says customer-list files should be CSV or TXT, have at least one main identifier, and should contain at least 1,000 customers. Since every approved cohort is below that guideline, do not pad or merge cohorts simply to meet it. The exact nine cohorts may populate but can remain unavailable or have limited delivery utility until they are larger; this is not a reason to add unverified or cross-category records.[3]

## Track A — manual initial build

Begin in the designated ad account’s Audiences screen:

**https://business.facebook.com/adsmanager/audiences?act=10207858653523297**

This screen was opened and confirmed to be ad account `10207858653523297`. It currently shows the normal **Create audience** control. Before beginning, search for `Urban Monk Lead Scraper – Health Intent Leads` only to confirm it remains present; do not select, edit, delete, share, or update it.

### Pre-upload control

Before creating any files or pressing an import button, confirm all of the following:

| Check | Required outcome |
|---|---|
| Account | Meta Audiences shows account `10207858653523297` |
| Scope | One and only one of the nine rows in the batch table is selected |
| Data | The file has one header: `email`; its row count equals the approved count exactly |
| Exclusivity | The file contains only verified, normalized business emails and has no cross-category duplicate |
| Existing audience | `Urban Monk Lead Scraper – Health Intent Leads` has not been selected or changed |
| Source declaration | Select the truthful Meta option for data obtained from a partner/data provider; do not represent Apollo-sourced contacts as directly collected from the customer |
| Use | Choose **Inclusions**, not **Only exclusions** |
| Stop condition | Stop if Meta requires a declaration that is not true, the source mapping is unclear, the row count is wrong, or a health/sensitive-data label appears |

### Exact Meta workflow, repeated one cohort at a time

1. Select **Create audience** → **Custom audience** → **Customer list** → **Next**.
2. Choose **Inclusions**. Do not choose “Only exclusions.”
3. Select **Upload a file**, choose the one protected CSV for the selected cohort, and map the `email` column to **Email**. Meta’s manual upload flow hashes the mapped identifiers before matching.[1]
4. Enter the exact audience name from the batch-definition table. Use the optional description only if available: `Exclusive verified Apollo business-email professional cohort. Manual updates pending approved API sync; no fallback audience.`
5. When Meta asks where the data came from, use the option that accurately represents a **partner/data provider** source. Accept terms only after confirming that the current authorized use matches the terms.
6. Confirm the mapping checkmark is present; do not upload a mismapped column. Select **Import and create**.
7. Return to Audiences and verify only that the audience is present and **Populating**. Record the Meta audience ID in the operational tracker once displayed. Do not create an ad, ad set, campaign, lookalike audience, or share the audience.
8. Wait for Meta’s processing state before interpreting availability. Do not claim a match rate or usable audience size immediately. Meta says an audience can show as **Populating** before it becomes **Ready**, and updates may take time.[1] [4]

Repeat only after confirming the prior cohort’s audience name, count, source declaration, and status. A protected local export utility has been prepared at `scripts/export-apollo-manual-audiences.mjs`; it requires an explicit action-level confirmation environment value, writes only outside the repository with owner-only file permissions, refuses count drift, never calls Meta, and must never be attached, committed, emailed, or logged.

### Manual refresh rule until Track B is approved

Until Meta grants the required access, updates remain manual and review-controlled. Each refresh must re-run the exclusivity and row-count checks above; it must add only newly eligible verified emails to their exact category audience, remove no data without a separately approved suppression/removal process, and never use the generic Health Intent audience as a fallback. Keep a private operational log of date, operator, category, submitted rows, audience ID, and Meta status—never email addresses.

## Track B — Marketing API Access Tier review

### Confirmed blocker

The owner’s Meta screenshot shows **Urban Monk Ads Manager** (app ID `2150724875769823`) with **Marketing API Access Tier** under **Not submitted**. This is the application-level blocker behind the failed read-only Custom Audience permission test. Generating additional system-user tokens will not resolve an application-review status.

Meta’s current developer documentation distinguishes ordinary app permission access from Marketing API Access Tier. It identifies `ads_management` plus Marketing API Access Tier as the expected pairing for an app managing ads on an ad account it owns or can access, and it provides the in-dashboard request path for advanced feature access.[4]

### Prepare before opening the submission

| Meta submission item | Verified or required input | Safe entry guidance |
|---|---|---|
| App | Urban Monk Ads Manager (`2150724875769823`) | Do not switch to a different app. |
| Feature | Marketing API Access Tier | Select only this feature for the current API-sync purpose. |
| Related permissions | `ads_management` and `ads_read` | Confirm these appear for the Marketing API use case; do not request unrelated WhatsApp, Pages, Threads, catalog, or profile permissions. |
| Business identity | Urban Monk Productions, Inc. | Use only the legal/business information already verified in Meta. Do not guess addresses, tax identifiers, documents, or ownership data. |
| Privacy policy | https://theurbanmonk.com/privacy-policy/ | This public policy identifies Urban Monk Productions, Inc., includes Meta-advertising data-use language, and provides support, GDPR, and CCPA contacts. |
| Support contact | `support@theurbanmonk.com` | Use only if Meta asks for a support contact. |
| Deletion request handling | `gdpr@theurbanmonk.com` / `ccpa@theurbanmonk.com` as stated in the public privacy policy | Do not claim a dedicated automated app-deletion URL exists. If Meta requires one, stop and add an owner-approved public page first. |
| Data source statement | Owner-authorized partner/data-provider business contact data from Apollo | Do not call it first-party opt-in data or claim it was directly supplied by the listed individuals. |
| Sensitive data boundary | No patient data, health status, diagnosis, treatment, test result, financial data, or customer-value data is sent | Keep the explanation limited to professional-role cohorts and hashed/normalized email matching. |

### Proposed submission narrative — copy only after verifying it is true

> Urban Monk Productions, Inc. uses this app to administer its own authorized Meta ad account and maintain customer-list Custom Audiences for owner-authorized business contact cohorts. The app will create and update only category-specific professional-role audiences using normalized and SHA-256-hashed business-email identifiers. The records originate through an authorized partner/data-provider workflow and are deduplicated so a person belongs to one approved category only. The app does not upload patient data, health status, medical conditions, diagnoses, treatments, testing information, financial information, or other prohibited sensitive information. No audience is shared across advertisers, and no outreach, messaging, campaign creation, budget change, or ad activation occurs through this workflow. Once approved, the app will run a controlled, logged daily update that adds newly verified contacts only to the exact corresponding audience and retains a manual pause control.

> The narrative must be edited or withheld if any part is not fully accurate at submission time. It is an operational description, not legal advice or a substitute for Meta’s terms.

### Exact navigation and stop point

1. Go to **https://developers.facebook.com/apps/** and choose **Urban Monk Ads Manager**.
2. Open **Review** → **App Review**.
3. Locate the row **Marketing API Access Tier** shown under “New requests.”
4. Use the corresponding review/request flow. Fill only the fields that are factually verified above.
5. Stop before the final **Submit** control and obtain owner confirmation, because the final submission includes Meta-facing declarations.

The current App Review screen includes unrelated requests such as WhatsApp and Pages permissions. Leave them untouched. The review should be limited to the app’s Marketing API feature and the two advertising permissions required for the approved owner-account use case.

## After approval — controlled daily category sync only

After Meta approves the relevant feature/permissions, rerun the existing non-mutating `server/metaAudienceCredentials.test.ts` first. Only if that test passes may the integration be configured to update existing audience IDs. The automation must be idempotent, independently pausable, logs-only-without-PII, and constrained as follows:

| Guardrail | Required implementation |
|---|---|
| Audience targeting | Add newly verified normalized emails only to their exact category audience ID. |
| No fallback | Never add a category cohort to `Urban Monk Lead Scraper – Health Intent Leads` or another generic audience. |
| Exclusivity | Use the same category-priority deduplication before every run. |
| No outreach impact | Do not enroll contacts into Sendy/Kajabi/Klaviyo, send a message, or trigger a campaign. |
| No ads impact | Do not create or edit campaigns, ad sets, ads, targeting, lookalikes, budgets, or bids. |
| Control | Provide an explicit pause switch and run log that records counts and audience IDs only. |
| Error behavior | A permission, mapping, count, or status error stops the run; it must not route contacts to another audience. |

The daily synchronization is deterministic and should run as a deployed, authenticated scheduled request rather than an in-process timer. It must be configured only after an approved build is deployed, with a durable task identifier, error handling, retry-safe idempotency, and a manual pause control.[5]

## References

[1]: https://www.facebook.com/business/help/170456843145568 "Meta Business Help Center — Create a Customer List Custom Audience"
[2]: https://www.facebook.com/business/help/606443329504150 "Meta Business Help Center — Prepare Your Data for a Customer List Custom Audience"
[3]: https://www.facebook.com/business/help/2082575038703844 "Meta Business Help Center — Customer List Formatting Guidelines for Custom Audiences"
[4]: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization "Meta for Developers — Marketing API Authorization"
[5]: https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/custom-audiences "Meta for Developers — Customer File Custom Audiences"
