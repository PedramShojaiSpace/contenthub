# Coach Appointment-to-Purchase Conversion Analysis

**Status:** In progress, read-only

## Objective

Measure the twelve-month relationship between completed Calendly appointments and Shopify paid orders for Bruce Jones, Deanna Clausen, Naomi Hyman, and Sarah Besocke. The report will use completed appointment attendance as the denominator and Shopify paid orders as the primary transaction truth. The reporting period will run from 2025-09-16 through 2026-09-16, evaluated in Central time.

## Required metric definitions

| Metric | Definition | Required evidence |
|---|---|---|
| Basic-to-high-ticket conversion | Unique completed appointments associated with a basic-package purchase that later produce an eligible high-ticket paid order within the approved attribution window, divided by unique completed basic-package buyers. | Calendly appointment, Shopify paid-order timestamps, and a verified customer match. |
| Explore-tier conversion | Unique completed appointments associated with a paid Explore-tier order, divided by each coach’s completed appointments. | Calendly appointment owner/status and Shopify paid order. |
| Explore-to-big-ticket conversion | Unique Explore-tier purchasers who later produce an eligible big-ticket paid order within the approved attribution window, divided by unique Explore-tier purchasers. | Shopify tier mapping and paid-order sequence. |

The initial calculation will use a **180-day post-appointment window** for an appointment-to-order association, with a one-order-per-person-per-tier rule. The final report will separately show unmatched appointments and paid orders so attribution coverage is transparent. Any different historical sales-cycle policy will be treated as a sensitivity analysis rather than silently mixed into the headline percentage.

## Confirmed access and current limitations

The owner’s authenticated Calendly calendar is accessible in read-only form. Its scope selector exposes an organization-wide **All Users & Teams** option and a **Sales** group, so the relevant coach calendars appear to be in the same Calendly organization. The existing Shopify connector is enabled for the Urban Monk Productions account. Calendly’s configured connector was enabled for this analysis, but its programmatic service endpoint did not become available in the current session; the authenticated browser/export workflow will be used instead if the provider tool remains unavailable.

The browser’s Calendly Sales-group view is accessible and currently lists 49 meetings in its on-screen window. Its built-in **Export** control confirms that a full Sales-group extract exceeds the provider’s immediate file-delivery size limit and asks for a shorter date range. The date picker exposes month navigation and individual-day selection; the next retrieval step will determine whether an export can be constrained by date range or must be safely collected in shorter time intervals. No appointment records have been edited or exported outside the owner’s Calendly account.

The active Sales calendar supports a single anchor-date picker rather than an obvious date-range dialog. The analysis will therefore avoid treating the on-screen calendar as the full historical source and will use either a provider export interval or paginated retrieval after confirming an accurate, reproducible date boundary.

The Calendly service is now available for the current session and exposes read-only organization membership and scheduled-meeting retrieval. The next step is to resolve the organization URI and membership records for the four named coaches, then retrieve the completed/canceled appointment history over the defined period using pagination rather than relying on an oversized browser export.

## Verified Access and Coach Roster

| System | Verified status | Analysis use |
|---|---|---|
| Calendly Sales organization | Read-only API access is active. | Appointment history can be retrieved by named coach in paginated 12-month windows. |
| Bruce Jones | Calendly organization member verified. | Appointment host attribution. |
| Deanna Clauson | Appears in Calendly as **Deanna Clauson, Health Coach \| The Urban Monk**. | Appointment host attribution. |
| Naomi Hyman | Calendly organization member verified. | Appointment host attribution. |
| Sarah Besocke | Calendly organization member verified. | Appointment host attribution. |
| Urban Monk Productions Shopify Admin | Authenticated browser access verified at `https://admin.shopify.com/store/theurbanmonkstore/orders`. | Read-only paid-order history and product/line-item classification. |

The project Shopify integration reports connected successfully, but the multi-account Shopify MCP query currently returns a session-level active-account error despite the project configuration naming Urban Monk Productions as active. The authenticated Shopify Admin browser is available as a read-only fallback while the connector session binding is resolved. No orders, products, customers, payments, or store settings have been modified.

## Working Data References

The analysis window is **2025-09-16 00:00:00 UTC through 2026-09-16 23:59:59 UTC**. The source Shopify CSV was manually exported from the authenticated Urban Monk Productions Shopify Admin orders page using `created_at:>=2025-09-16` plus **Payment status = Paid** and includes order-level and line-item fields. The uploaded file contains customer data and must be treated as transient analysis input only; final reporting will contain aggregate coach/tier results only.

| Coach | Calendly user URI |
|---|---|
| Bruce Jones | `https://api.calendly.com/users/a25c224d-c9f6-4777-8e03-62983016bdd9` |
| Deanna Clauson | `https://api.calendly.com/users/af9b1793-c707-40b5-814b-fe5c038269ca` |
| Naomi Hyman | `https://api.calendly.com/users/8a0006c3-563a-46c5-bfac-dd64ecaa5b7d` |
| Sarah Besocke | `https://api.calendly.com/users/63a08edc-00a8-4255-b735-c85c95d29475` |

Calendly organization URI: `https://api.calendly.com/organizations/cd20c09f-7df1-4969-8c2e-d2be9f40dc5d`. The next retrieval step is to page each named coach’s active and canceled event history within the stated window, obtain invitee emails only for hashed matching, then discard raw identity-level extracts after the aggregate matching table is built. The current Sales-group export warns that its unrestricted selection is too large to send; if the invitee API cannot be efficiently aggregated, shorter historical export intervals will be used as the reproducible fallback.

## Retrieval Evidence — 2026-09-16

The first 100 active events for each named coach were retrieved in chronological order from Calendly for the stated analysis window. Raw event pages are transient, PII-bearing source inputs only and will be removed after aggregation. Bruce’s first two active-event pages both contain 100 events and require further pagination; the second page returned next-page token `twyn4nWHuU0PkAdsvECv4ws2sN2wCgH5`. Deanna, Naomi, and Sarah first active-event pages are retrieved and require pagination checks before final denominator counts.

The uploaded paid-order export contains **1,827 unique orders** and **1,969 line rows** in the exported date scope, including **1,774 paid**, **30 partially refunded**, and **23 refunded** orders. The aggregate product profile confirms the actual tier vocabulary: `Explore Testing Tier`/`Orobiome Explore Tier` variants, `SAGE Program` variants, `CATALYST` variants, and `FMT PROGRAM`/`Gateway Oral Health Program` high-ticket variants. The tier mapping will be inferred from SKU/name/realized order amounts and explicitly disclosed, rather than inferred solely from display price.

As of the latest read-only pagination pass, complete active-event retrieval is confirmed for Bruce (**248 events**) and Sarah (**170 events**). Deanna has **575 events** retrieved across six pages and is complete. Naomi has at least **600 events** retrieved across six pages and requires one final pagination check before her denominator is complete. These are raw active-calendar event counts only; final appointment denominators will be restricted to the documented sales-consultation event types, with coaching/follow-up/review events separately disclosed rather than silently mixed into sales conversion rates.

The current request treats Shopify as the principal paid-order ledger. Stripe will remain a separately disclosed coverage gap unless the owner supplies a Stripe export or explicitly directs a connected Stripe reconciliation; Stripe revenue will not be silently blended into Shopify conversion rates.

## Data protection

Raw attendee names, email addresses, phone numbers, meeting notes, and order lines will not be reproduced in reports. Any temporary export will be processed locally only, reduced to anonymized matching keys and aggregate coach/tier measures, and removed after validation.
