# Coach Conversion Analysis — Data Repair Guide

**Purpose:** Build an auditable, four-coach conversion report that distinguishes **new sales consultations** from **ongoing coaching and service calls** and measures the intended package progression accurately.

## Why the current extracts cannot answer the question reliably

The existing Calendly export contains event labels such as **“Gut Health Consultation,” “1 on 1 Coaching,” “Follow-Up,” “Action Plan,”** and **“Explore Tier Test Review.”** The explicit coaching, follow-up, review, onboarding, and graduation labels can be excluded. However, a substantial number of existing-client coaching conversations use the same broad **“Gut Health Consultation”** label as true new-sales consultations. The existing 12-month Shopify export also cannot identify clients who started a program before the analysis window.

> The provisional rates should therefore **not** be used to rank coaches, calculate compensation, or assess close performance. They are a data-coverage diagnostic, not a final scorecard.

## Required output definitions

Before export, the business owner should confirm the following taxonomy. Do not infer these definitions from price alone.

| Metric | Required definition | Required decision |
|---|---|---|
| **New sales consultation** | A first consult with a prospect who was not already an active coaching/program client at the appointment time | Does a new prospective client who owns a low-cost test count as new sales? |
| **Basic package** | Exact SKUs/products that form the designated entry package | List exact Shopify SKUs, not broad words such as “testing.” |
| **Explore Tier** | Exact Explore/Orobiome Explore SKUs/products | Confirm whether same-day basic-to-Explore transactions count as a progression. |
| **Big-ticket program** | Exact SAGE, Catalyst, FMT, Deep Sleep SAGE, or other approved big-ticket SKUs | Confirm whether installments count at first paid installment or only at fully paid status. |
| **Attribution window** | Time allowed after a qualifying sales stage for a paid purchase to receive coach credit | Default proposed window: 180 days. |

## Data package A — Shopify orders

Export **all Shopify orders from September 16, 2024 through September 16, 2026**. The additional 12 months before the analysis period is necessary to identify clients who were already purchasers before the 12-month performance window.

In **Shopify Admin → Orders**, export **All orders**, not only paid orders. Include the following columns if available:

| Export field | Why it is needed |
|---|---|
| Order name/ID | Deduplicate line-item rows |
| Customer email | Temporary hashed appointment-to-order matching key |
| Created date and Paid at | Sequence appointments and purchases correctly |
| Financial status, Cancelled at, Refunded amount | Net out invalid or reversed sales |
| Line-item name, SKU, quantity, price, discount | Map products to the approved tiers |
| Customer tags, order tags, notes, note attributes | Recover explicit coach or program evidence where available |
| Source and payment method | Separate web, draft, subscription, and manual-payment flows |

Upload the resulting CSV here. Customer identity will be used only in-memory to create one-way hashes and will not appear in the report.

## Data package B — Calendly appointment exports

Export **each coach separately** for **September 16, 2024 through September 16, 2026**. If Calendly prevents a two-year export, use these eight quarterly intervals per coach:

| Export interval | Dates |
|---|---|
| Q1 | Sep. 16–Dec. 15, 2024 |
| Q2 | Dec. 16, 2024–Mar. 15, 2025 |
| Q3 | Mar. 16–Jun. 15, 2025 |
| Q4 | Jun. 16–Sep. 15, 2025 |
| Q5 | Sep. 16–Dec. 15, 2025 |
| Q6 | Dec. 16, 2025–Mar. 15, 2026 |
| Q7 | Mar. 16–Jun. 15, 2026 |
| Q8 | Jun. 16–Sep. 16, 2026 |

For each coach, select the individual calendar—**not the Sales-group export**—and preserve these fields:

| Calendly field | Why it is needed |
|---|---|
| User Name and User Email | Correctly identify the hosting coach |
| Invitee Email | Temporary hashed order-matching key |
| Event UUID | Stable key for a manual stage override |
| Event Type Name | Initial automated stage signal |
| Start Date & Time | Sequence relationship and purchase timing |
| Event Created Date & Time | Distinguish rebookings and reschedules where possible |
| Canceled and Marked as No-Show | Exclude non-held appointments |
| Questions and Answers | May contain an existing-client or purchase-status signal |
| Meeting Notes | May contain a disposition or program context, if used consistently |
| UTM fields and Salesforce UUID | Preserve attributable lead-source evidence |

## Data package C — appointment-stage override

Because generic “consultation” labels are ambiguous, a VA should review only the **analysis-period appointments** and create a CSV with these columns:

```csv
event_uuid,coach_name,appointment_start_utc,stage_override,reason
```

Use exactly one of these `stage_override` values:

| Stage | Use when | Counts in which denominator |
|---|---|---|
| `new_sales_consult` | First true prospect/sales conversation | Initial-consult conversion |
| `basic_purchase_review` | Conversation after a basic purchase designed to discuss Explore/upgrade | Basic → Explore/high-ticket progression |
| `explore_upgrade_review` | Conversation after Explore designed to discuss a bigger program | Explore → big-ticket progression |
| `existing_client_coaching` | Ongoing coaching/session/check-in | Exclude from acquisition conversion |
| `service_or_test_review` | Clinical review, onboarding, logistics, or support | Exclude unless explicitly an upgrade review |
| `cancelled_or_no_show` | Did not occur | Exclude |
| `unknown` | Cannot be classified from the record | Exclude from primary rate and report separately |

The override should be created from Calendly notes, the CRM, team knowledge, or an appointment-record review—not from a guess based solely on product price.

## The calculation that will be delivered after the repair

Each coach will receive four distinct figures, eliminating the ambiguity in the provisional result:

| Metric | Formula |
|---|---|
| **New consult → any paid program** | Unique `new_sales_consult` prospects with a qualifying paid program order within the approved window ÷ unique `new_sales_consult` prospects |
| **New consult → Basic** | Unique `new_sales_consult` prospects with a Basic paid order ÷ unique `new_sales_consult` prospects |
| **Basic → Explore/high-ticket** | Unique coach-attributed Basic buyers later purchasing Explore or big-ticket within the window ÷ unique coach-attributed Basic buyers |
| **Explore → big-ticket** | Unique coach-attributed Explore buyers later purchasing a big-ticket program within the window ÷ unique coach-attributed Explore buyers |

The delivered report will separately show raw appointment counts, unique prospects, appointment-stage overrides, no-shows, unmatched paid orders, refunded orders, direct sales with no coach attribution, and the confidence impact of small samples.

## References

[1]: file:///home/ubuntu/upload/events-export%282%29.zip "Owner-supplied Calendly events export, received September 16, 2026"
[2]: file:///home/ubuntu/upload/orders_export_1%282%29.csv "Owner-supplied Shopify orders export, received September 16, 2026"
