# Interconnected Agora Lead Reconciliation

**Prepared:** August 15, 2026  
**Scope:** Interconnected Agora lead reporting, Meta Lead-event measurement, and scale-readiness

## Executive conclusion

The underlying form/CRM database is **not producing double the number of people**. For the August 1–14 Central-time launch window, it contains **1,983 form-submission rows** and **1,941 unique normalized email addresses**. The difference is **42 repeat submissions (2.12%)**, which is ordinary repeat-form behavior—not a two-times inflation problem.

The double-count risk exists in the **Meta measurement layer**, in two independent places. First, a confirmed Interconnected form submission generated a server-side CAPI `Lead`, then the thank-you page also generated a browser `Lead` without sharing the CAPI event ID. Meta could therefore treat one actual opt-in as two leads. Second, the reconciliation code was summing three overlapping Meta action labels (`lead`, `onsite_conversion.lead_grouped`, and `complete_registration`) rather than selecting a single canonical lead value. That could multiply a single Meta-reported lead by as much as three when all representations were present on the same ad-set row.

## Evidence from internal lead records

| Measure, Aug. 1–14 Central time | Count | Interpretation |
|---|---:|---|
| Total Interconnected form rows | 1,983 | Raw submissions, including repeats |
| Unique normalized emails | 1,941 | **Canonical CRM opt-in baseline** |
| Repeat-submission rows | 42 | Normal repeat-form behavior |
| Repeat-submission rate | 2.12% | Not evidence of doubling |
| Rows marked CAPI Lead sent | 91 | CAPI status coverage recorded after the relevant instrumentation path began |
| Unique emails marked CAPI Lead sent | 88 | Confirms some repeat submissions share an identity rather than representing new people |

> **Operating rule:** Do not use raw Meta Lead totals as the scaling denominator until the event-ID repair has sufficient new traffic to validate. Use the Content Hub’s **unique normalized email** count for actual opt-ins and Meta spend for spend.

## Confirmed corrections now deployed

### 1. Browser/CAPI Lead deduplication

Both Interconnected opt-in variants now save the server-returned `capiLeadEventId` before redirecting. The active Kajabi-control thank-you page reads that exact ID and fires the browser Lead only when it exists. Meta can then deduplicate the matching browser and CAPI conversions.

The legacy static thank-you fallback has also been changed so it no longer fires an unpaired browser Lead when a visitor opens or reloads the page without a confirmed form submission.

### 2. Canonical Meta action selection

The Reconciliation dashboard and Funnel Advisor now select one lead representation per Meta insight row in this priority order:

1. `lead`
2. `onsite_conversion.lead_grouped` only if `lead` is unavailable
3. `complete_registration` only if neither prior action is available

The same rule now applies to checkout reporting: `initiate_checkout` is used first, with `add_to_cart` only as a fallback. Overlapping action types are no longer added together.

## How to scale safely from here

For the next seven days, use three measurements side by side rather than trusting any single platform number.

| Metric | Source of truth | Use |
|---|---|---|
| **Unique opt-ins** | Content Hub reconciliation: distinct normalized email addresses | Real acquisition volume and unique-lead conversion rate |
| **Spend** | Morning previous-day Agora batch | Cost control and pacing |
| **Meta canonical Leads** | Reconciliation dashboard after this fix | Ad-platform optimization signal and audit comparison |

Calculate actual cost per unique opt-in as **Agora spend ÷ Content Hub unique opt-ins**. Do not use the legacy Meta aggregate for historical CPL comparisons because the prior overlapping-action query overstated that count. Retain the old values only as historical platform-reported figures.

## Seven-day validation gate before scaling

The Agora funnel is ready to run, but should be scaled only after this validation check:

1. Let the repaired event flow collect a full seven days of new traffic.
2. Compare daily Meta canonical Leads with the daily unique email count in the Content Hub.
3. Investigate only material differences after allowing for Meta attribution timing and lead identity matching. The expected relationship is close alignment—not necessarily perfect equality.
4. Use cost per unique opt-in, $67 conversion rate, and recorded revenue ROAS together for scale decisions.

## Regression coverage

Six focused tests now cover the event-ID handoff, the prevention of unpaired browser Leads, and canonical action selection. All six passed before deployment.
