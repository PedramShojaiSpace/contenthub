# Kajabi Event Page — Meta Destination Trace

## Live Page Configuration

The owner-identified event route is:

`https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-event`

The live page rendered a Kajabi-native registration form. Its source identifies form `2148968212`, landing-page ID `2150943580`, and an explicit post-submit destination of:

`https://content.theurbanmonk.com/interconnected/thank-you-b`

This confirms the owner’s concern: event-page registrants are currently sent to Thank You B. No Kajabi route or form setting was changed during the trace.

## Meta Account Trace Status

The initially opened Ads Manager account (`10207858653523297`) contains relationship-focused ads and is not the dedicated Interconnected account. The authenticated account switcher identifies a separate **Interconnected Series** ad account, ID `2227181444228098`, under Urban Monk Productions, Inc. That account contains 1,118 ad records and is the correct account for continuing the URL trace.

The configured server-side Meta credential is associated with a different account ID (`1153114224705920`) and lacks `ads_read`/`ads_management` access to the browser-selected accounts. The remaining trace is therefore being performed through the authenticated Ads Manager interface only, without changing campaigns, ad sets, ads, budgets, or creative.

## Active Creative Trace — Configured Urban Monk Account

The configured Urban Monk Meta account is `1153114224705920`. A read-only active-ad creative query is available after using the correct `act_` account prefix. Its active Agora Interconnected campaigns include the following verified campaign IDs and destinations:

| Campaign ID | Campaign name | Verified ad destinations |
|---|---|---|
| `52590299920405` | CM - Top - Interconnected Agora Funnel - MAX VALUE PURCHASE - Aug 7th 2026 - Healthy Habits | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` |
| `52590299920805` | CM - Top - Interconnected Agora Funnel - MAX VALUE PURCHASE - Aug 7th 2026 - Organic product / high-net-worth | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` |
| `52590299921005` | CM - Top - Interconnected Agora Funnel - MAX VALUE PURCHASE - Aug 7th 2026 - Natural foods | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` |
| `52590299921205` | CM - Top - Interconnected Agora Funnel - MAX VALUE PURCHASE - Aug 7th 2026 - Health & Wellness | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` |

Examples include “90% of Chronic Disease Starts in the Gut,” “Leaky Gut diagram, damaged vs healthy barrier,” “Your Immune System Isn’t Attacking You,” “Even Healthy Foods Can Trigger Your Flares,” and “Trailer with Bushel Behind Video REEL FORMAT.” The trace currently shows the **Meta** page path, not the owner-identified **event** page path. A complete exact-string extraction is required before declaring that no active creative uses the event page.

## Exact-String Result

A complete read-only extraction across the configured Urban Monk account’s active creative response returned **0 exact matches** for `ic-interconnected-free-screening-event`.

> **Confirmed conclusion:** No active ad in configured account `1153114224705920` currently uses the owner-identified event page as its destination. Verified active Agora Interconnected campaigns use `ic-interconnected-free-screening-Meta` instead.

The separate Interconnected Series account (`2227181444228098`) is visible in the owner’s authenticated browser and contains historical ad records, but its API permission is not granted to the configured server credential. A name-based browser filter returned no ad names containing `event`; that does not independently prove that no historical creative in that separate account has the event URL. No campaign, ad set, ad, budget, URL, or Kajabi setting was changed during the trace.
