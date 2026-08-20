# Interconnected Purchase Measurement: Single-Source Architecture

## Recommendation

> Use the **Content Hub’s paid Kajabi webhook → server-side Meta CAPI Purchase event** as the **only Purchase emitter and system of record** for the Interconnected Kajabi path. Retain browser-side tracking for upper-funnel behavior, but do not allow Kajabi’s native Pixel integration to send a second Purchase event into the same Pixel unless it can share the exact same `event_id` as the Content Hub CAPI event.

This is the cleanest design because a paid Kajabi order is the authoritative commercial fact. It supplies a unique order ID, confirmed payment state, correct amount, funnel source, and a durable audit trail. Browser purchase events are inherently less trustworthy for revenue accounting: they can be blocked, replayed, fired on a thank-you view rather than a paid state, or coexist with a CAPI event without deterministic deduplication.

The current evidence supports this architecture. Meta’s scoped snapshot reports 24 Purchases / $1,137 while first-party Kajabi records show 13 paid orders / $1,003. Kajabi’s native Facebook Pixel is enabled on the same Pixel ID as the Content Hub’s CAPI sender, and the Kajabi settings screen does not expose a shared event-ID control. This is a credible duplication mechanism, although it is not yet a proof of exactly how every excess event was created.[1](meta-purchase-tracking-audit-2026-08-16.md)

## Target Event Design

| Funnel event | Authoritative emitter | Event use | Required identifier / evidence |
| --- | --- | --- | --- |
| PageView | Browser pixel on Content Hub and, if needed, a controlled Kajabi base-pixel installation | Audience building and page diagnostics | Standard browser event; not revenue truth |
| Lead / CompleteRegistration | Content Hub browser pixel + CAPI where already configured | Lead optimization and funnel measurement | Existing lead ID / event ID contracts |
| InitiateCheckout | Content Hub browser event at the $67 CTA | Checkout-intent optimization | Existing path and checkout-link context |
| **Purchase** | **Content Hub Kajabi paid webhook → CAPI only** | Revenue, ROAS, Purchase optimization | One deterministic `event_id` derived from paid order ID; redacted CAPI receipt; first-party order row |
| Refund / chargeback | First-party order system, then a dedicated server-side correction event or offline reporting process | Net-revenue governance | Original order ID and refund record |

The web browser still has an important role in the funnel. It should measure what a visitor does before a confirmed payment—landing-page views, registration, offer views, and checkout starts. It should not be trusted as the final authority for a Kajabi purchase when a paid webhook can state the amount and order identity with certainty.

## Required Kajabi Configuration Decision

Kajabi’s native Facebook Pixel integration is site-level and currently enabled. The browser view exposes only a Pixel ID and Access Token, not a granular “send Purchase but not PageView” or shared-event-ID setting. Therefore the practical cutover depends on what Kajabi can do in its current configuration.

| Option | Decision | Assessment |
| --- | --- | --- |
| **Recommended** | Disable Kajabi’s native Facebook Pixel integration for this site, including its native Access Token path; retain Content Hub CAPI as the sole Purchase emitter. If Kajabi pageview visibility remains useful, add only a controlled base-pixel PageView implementation through Kajabi custom code after confirming it cannot auto-fire Purchase. | Best measurement integrity; avoids a native un-deduplicated Purchase path. Requires a controlled site-level tracking change. |
| Acceptable only if technically supported | Keep Kajabi native Pixel but configure it not to emit Purchase, or configure it to use the exact Content Hub order-based `event_id` for browser/CAPI deduplication. | Potentially preserves browser checkout page views, but Kajabi’s visible UI does not currently expose this control. Do not assume it works without an Events Manager test. |
| Not recommended | Keep both current paths and reconcile later. | Continues to contaminate Purchase counts and can mislead optimization and ROAS. |

> **Important scope boundary:** This recommendation is for the **Kajabi Academy / Interconnected** site path only. It does **not** change Shopify’s primary Mega MEGA Pixel, Shopify checkout behavior, or any unrelated Meta campaign.

## Cutover Plan

### 1. Record the pre-cutover state

Before changing anything, record the enabled Kajabi Pixel state, Pixel ID, whether the Access Token field is populated, the current Content Hub CAPI configuration, and the last 24-hour reconciliation snapshot. Save a screenshot or exported configuration note, but never copy an access token into project documentation.

### 2. Confirm the web-hook source is ready

The new CAPI delivery audit must be live and its database migration present. Confirm that a paid Kajabi webhook writes a first-party order row, then records a redacted CAPI receipt with the order-derived event ID, Meta response status, accepted/rejected result, amount, funnel, and timestamp.

### 3. Make one controlled change

Disable the **Kajabi native Facebook Pixel** integration and remove its native Access Token use for the Academy site. Do not change the Content Hub CAPI Pixel ID, Meta conversion objective, campaigns, budget, checkout, or content. If controlled Kajabi PageView instrumentation is later needed, add it as a separate measured change—never in the same cutover.

### 4. Verify the next three real paid orders

For each of the next three genuine paid Interconnected Kajabi orders, compare the same order across all three evidence layers.

| Check | Pass criterion |
| --- | --- |
| First-party order | Exactly one paid order with correct value and product |
| Content Hub CAPI audit | Exactly one accepted Purchase receipt, carrying the deterministic order event ID |
| Meta Events Manager / Purchase report | One attributable Purchase after normal Meta processing delay; no duplicate browser Purchase for the order |
| Reconciliation | The difference between Meta Purchase count/value and first-party orders narrows within the pre-agreed reporting window |

Do not judge the cutover from a single immediate Ads Manager reading: Meta reporting can be delayed and attribution windows can differ. Use a fixed date range and compare it to the exact paid-order cohort.

### 5. Rollback plan

If the next paid order lacks a CAPI receipt, shows a rejected Meta result, or is absent from Meta after the agreed processing window, restore the saved Kajabi native Pixel configuration. Do not change campaign optimization during the rollback. The saved pre-cutover configuration makes this reversible.

## Reporting Governance

The Content Hub Reconciliation view should become the operating console for this decision. The page already separates first-party order data from one-call Meta insights and now has a Purchase Evidence layer. The authoritative hierarchy must be:

1. **Financial truth:** paid Kajabi / Shopify order records, net of refunds.
2. **CAPI delivery health:** redacted server receipt and Meta response for the exact order event ID.
3. **Meta reporting:** attributed Purchase count and value, used for delivery optimization and ROAS diagnostics but not as the ledger.

Only the first layer decides actual revenue. A material discrepancy in the third layer triggers an investigation; it never overwrites the ledger.

## Approval Requested

The recommended action is a **controlled Kajabi-native Pixel cutover**: turn off only the Academy site’s native Facebook Pixel and Access Token path, then validate the next three real Kajabi paid orders against the Content Hub CAPI audit. This is a tracking-system change, not a campaign, checkout, or product change. It requires explicit approval before execution.

## Shopify Migration Inventory — Read-Only

The owner-provided Shopify Customer Events screen confirms two relevant current paths:

| Shopify Customer Event | Delivery surface | Current data quality label | Migration implication |
| --- | --- | --- | --- |
| Facebook & Instagram | Server + Web | Optimized | This is the app-managed Shopify Meta integration and is the current primary checkout event pathway that must be deliberately reassigned to the Urban Monk Pixel. |
| MEGA - Sleep Kit Purchase | Web | No optimization label shown | This is a separate custom Web pixel that should be explicitly inventoried and retired or scoped during the migration; it must not silently remain as a second Purchase emitter. |

The screen does not display the connected Meta Pixel ID or connected business account in its list view, so the next read-only step is to open the Facebook & Instagram app configuration and the MEGA custom-pixel record to capture those exact ownership and event settings. No Shopify Customer Event, data access setting, checkout configuration, or pixel assignment has been changed.

The Shopify Customer Events detail confirms the Facebook & Instagram integration is a dual **Server + Web** optimized customer-event integration. The MEGA - Sleep Kit Purchase record is separate and Web-only. Shopify’s list-level data-access control does not expose the Meta Pixel ID or connected business-account identity. Therefore the unified cutover cannot be safely executed from Customer Events alone: the exact Meta connection must be confirmed in the Facebook & Instagram sales-channel configuration, and the MEGA custom-pixel record must be inspected for its event script before any ownership or pixel change is approved.

The Shopify Facebook & Instagram sales-channel route opens successfully in the connected owner browser, but its embedded configuration surface has not yet loaded any connection or pixel detail. No control has been clicked. Until Shopify renders that configuration or the owner provides its settings sub-route, the current exact connected Pixel ID remains unverified from the Shopify source.

## References

[1] [Meta Purchase tracking audit and live evidence](meta-purchase-tracking-audit-2026-08-16.md)
