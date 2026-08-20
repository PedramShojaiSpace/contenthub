# Kajabi Checkout and Post-Purchase Tracking Audit

**Audit date:** August 16, 2026  
**Scope:** Read-only review of the active Kajabi **Interconnected $67 Bundle OTO** offer, its purchase flow, and its checkout-template editor.  
**Changes made:** None.

## Observed Offer Flow

| Area | Observed configuration | Tracking implication |
|---|---|---|
| Offer | `Interconnected $67 Bundle OTO` / offer ID `2151314475` | Active Kajabi entry offer under review. |
| Post-purchase destination | Existing landing page: **Interconnected Purchased — Redirect** | Buyer routing is configured at the offer level, not in a separate tracking panel. |
| Post-purchase email | Default email | No separate conversion emitter was exposed in the reviewed control. |
| Upsell funnel | First published upsell: current $199 Gut Permeability and Food Sensitivity Testing OCUS | The offer-level upsell is visible in the purchase flow; no event-ID or Purchase-deduplication field was exposed. |

## Checkout Template Review

The offer’s **Edit checkout** surface is a checkout-template editor. Its available sections were Header, Checkout, Image, Custom Code, Footer, Exit Popup, and Two Step Optin. The existing Custom Code block is labeled **“INTERCONNECTED — Kajabi Checkout CRO Snippet v3.”** Its visible content is a checkout presentation/CRO customization; it did not expose a separate Facebook Pixel ID, browser Purchase toggle, conversion-event identifier, or event-ID deduplication configuration.

## Current Measurement Boundary

The site-level Kajabi Facebook Pixel integration remains the only observed Kajabi-native Meta setting. It is already documented as using the Urban Monk Pixel that Content Hub CAPI also targets. This offer-level review did not identify any separate checkout or thank-you-page tracking control that could prove or disable a Kajabi browser Purchase event, or deduplicate it with the Content Hub server-side Purchase.

> The absence of a visible offer-level control does not prove that Kajabi emits no browser Purchase event. It means the current authenticated offer and checkout-template surfaces do not expose a setting to inspect or control that behavior.

## Operating Recommendation

Keep the existing approval-gated single-source Purchase architecture decision intact. Do not change the offer’s redirect, default email, upsell, checkout template, or native Pixel configuration based only on this inspection. The remaining authoritative validation is a controlled observation of the next genuine paid Kajabi purchase against the first-party order, Content Hub CAPI receipt, and Meta event evidence.
