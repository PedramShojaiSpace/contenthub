# Urban Monk Content Hub — Change Log

> **Living document.** Every deployment to production is logged here automatically via git commits.
> This file is the authoritative record of what changed, when, and why — for Curt, Pedram, and the team.

---

## How to Read This Log

Each entry shows:
- **Date/Time (CT)** — when the change went live
- **What changed** — plain-English summary
- **Files affected** — which pages/systems were modified
- **Impact** — what the change affects for visitors/leads/ads

---

## 2026-08-05

### 19:17 CT — Lead notifications + Kajabi spot-check
**What changed:**
- Every new Interconnected opt-in now sends an instant notification: name, email, phone, source, Kajabi tag status
- Hourly watchdog now also queries Kajabi API to verify "Interconnected Opt In" tag count matches our DB
- If Kajabi is more than 10 leads behind our DB → sends a "Kajabi Tagging Gap" alert
- During peak hours (6am–10pm CT), sends a clean hourly status report showing leads in window + Kajabi count

**Files:** `server/interconnectedRouter.ts`, `server/leadWatchdogHandler.ts`
**Impact:** Owner notifications only — no visitor-facing changes

---

### 18:01 CT — Shopify commerce infrastructure
**What changed:**
- Built complete Shopify checkout infrastructure (server/shopify.ts, server/shopifyRouter.ts)
- FUNNEL_PRODUCTS SKU map with all active variant IDs
- buildCheckoutUrl() embeds attribution token + UTM params into every cart permalink
- Upgraded Shopify order-paid webhook: Meta CAPI now fires for ALL orders (not just attributed ones)
- Klaviyo "Placed Order" event + buyer property tagging on every Shopify purchase
- tRPC procedures: getCheckoutUrl, createCheckout, listFunnelProducts, testConnection

**Files:** `server/shopify.ts` (new), `server/shopifyRouter.ts` (new), `server/attributionRouter.ts`
**Impact:** Backend only — buy buttons NOT yet switched to Shopify. Pending Dr. Pedram's go-ahead.

---

### 14:39 CT — A/B test tracking fix (static page)
**What changed:**
- Root cause found: `/interconnected/thank-you` is served by a static HTML page that bypasses the React SPA
- Added A/B tracking JavaScript directly into the static thank-you page
- `assignVariant` API call now fires on every new visitor to the thank-you page
- Video A (hobj7srg3q) vs Video B (10cdtpm3il) now correctly assigned and tracked
- Conversion tracking added to buy button clicks

**Files:** `server/interconnectedThankYouStaticPage.ts`
**Impact:** A/B test dashboard now accumulates real exposure data going forward

---

### 12:15 CT — A/B test tracking fix (React splitter)
**What changed:**
- Fixed silent Zod validation error: `utmContent` field was not in `assignVariant` schema
- Removed duplicate `assignVariant` calls from TY pages A and B
- Added `ic_lp_variant` write to localStorage in both LP-A and LP-B on form submit

**Files:** `client/src/pages/InterconnectedThankYouSplitter.tsx`, `client/src/pages/InterconnectedThankYou.tsx`, `client/src/pages/InterconnectedThankYouB.tsx`, `client/src/pages/Interconnected.tsx`, `client/src/pages/InterconnectedB.tsx`
**Impact:** A/B tracking — no visitor-facing changes

---

### 01:46 CT — Smart lead watchdog (overnight suppression)
**What changed:**
- Overnight hours (10pm–6am CT) now use a 3-hour window before alerting (was 65 min)
- Peak hours (6am–10pm CT) keep the 65-minute window
- Every alert now includes today's total lead count for context

**Files:** `server/leadWatchdogHandler.ts`
**Impact:** Fewer false overnight alerts — no visitor-facing changes

---

## 2026-08-04

### 22:25 CT — Kajabi webhook amount fix + A/B tracking fix
**What changed:**
- Fixed Kajabi webhook sending `amount=0`: added OFFER_PRICE_MAP lookup by offer ID
- Backfilled 5 existing DB records from $0 to correct amounts
- Fixed A/B tracking: Version B had no tracking, visitor ID key mismatch fixed
- Fixed watchdog column name bug

**Files:** `server/_core/index.ts`
**Impact:** Revenue tracking accuracy improved — no visitor-facing changes

---

### 17:29 CT — Meta pixel immediate load + Lead event on form submit
**What changed:**
- Meta pixel moved from 3-second deferred load to **immediate load** in both Page A and Page B
- Added `fbq('track', 'Lead')` call on successful form submit with 300ms delay before redirect
- Added `<noscript>` pixel fallback tag

**Files:** `server/interconnectedStaticPage.ts`, `server/interconnectedBStaticPage.ts`
**Impact:** ⚠️ **AFFECTS OPT-IN RATE METRICS IN META ADS MANAGER**
- Before: pixel loaded after 3s → Meta was attributing PageView events as leads (inflated numbers)
- After: pixel fires correctly as a proper `Lead` event → Meta reports accurate lead counts
- **This is why Curt saw opt-in rate drop from ~34% to ~16%** — the old number was inflated by incorrect pixel attribution. The actual form submission rate did not change.
- DB lead counts: Aug 3 = 322, Aug 4 = 131 (ads ran fewer hours), Aug 5 = 18 (still early in day)

---

### 13:44 CT — Split test architecture rewired
**What changed:**
- Removed server-side 50/50 redirect from `/interconnected` — Page A now serves directly
- Curt's ad URLs (`/interconnected` vs `/interconnected-b`) fully control landing page routing
- Both landing pages write `ic_lp_variant` to localStorage on form submit
- TY page splitter reads `ic_lp_variant` for cross-tabulation reporting
- Command Center updated with 4-column layout: Kajabi Sales | LP Split | TY Split | Meta Campaigns

**Files:** `server/_core/index.ts`, `server/interconnectedBStaticPage.ts`, `server/interconnectedStaticPage.ts`, `client/src/pages/InterconnectedCommandCenter.tsx`, `client/src/pages/InterconnectedThankYouSplitter.tsx`
**Impact:** Visitor routing changed — `/interconnected` no longer randomly redirects 50% to `/interconnected-b`. Curt's ad targeting now controls which page each visitor sees.

---

### 13:22 CT — CAPI Layer 3 + attribution fixes
**What changed:**
- New Customers Only toggle on `/reconciliation`
- Meta/Non-Meta attribution filter on reconciliation page
- Fixed Variant B landing page to forward fbclid, fbp, fbc, and pageVariant to server
- Fixed Kajabi purchase webhook to detect funnel from offer ID/name/amount

**Files:** `server/_core/index.ts`, `client/src/pages/InterconnectedB.tsx`
**Impact:** Attribution tracking improved — no visitor-facing changes to form

---

### 01:49 CT — CAPI tracking gaps fixed
**What changed:**
- Static Page A: now captures fbclid, _fbp, _fbc cookies, UTM params, sends pageVariant='A'
- Static Page B: same fbclid/fbp/fbc capture added, pageVariant='B' correctly sent

**Files:** `server/interconnectedStaticPage.ts`, `server/interconnectedBStaticPage.ts`
**Impact:** Meta CAPI lead matching quality improved — no visitor-facing changes

---

## 2026-08-03

### 21:58 CT — Full Meta Conversions API implementation
**What changed:**
- capiHelper.ts: SHA-256 hashed email/phone, event_id deduplication, Lead/InitiateCheckout/Purchase
- interconnectedRouter.ts: CAPI Lead fires server-side on every opt-in
- fbclid/fbp/fbc captured and stored in DB
- Kajabi purchase webhook: fires CAPI Purchase on every sale
- Schema: added capiLeadEventId, capiLeadSent, capiLeadSentAt, fbclid, fbp, fbc columns

**Files:** `server/capiHelper.ts` (new), `server/interconnectedRouter.ts`, `server/_core/index.ts`, `drizzle/schema.ts`
**Impact:** Improved Meta ad attribution — no visitor-facing changes

---

### 15:16 CT — Removed per-lead notifications, added hourly watchdog
**What changed:**
- Removed per-lead notifyOwner calls (was flooding inbox)
- Added leadWatchdogHandler: runs hourly, alerts only if zero leads in 65 minutes

**Files:** `server/interconnectedRouter.ts`, `server/leadWatchdogHandler.ts` (new)
**Impact:** Owner notifications only — no visitor-facing changes

---

*This log is maintained by the AI development agent. For questions, contact the development team.*
