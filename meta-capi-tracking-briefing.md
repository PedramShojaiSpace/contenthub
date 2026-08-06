# Meta Conversions API (CAPI) & A/B Split — Technical Briefing
**For: Kurt and the Ad Buying Team**
**Project: The Urban Monk — Interconnected Documentary Funnel**
**Domain: content.theurbanmonk.com**
**Date: August 4, 2026**

---

## Executive Summary

We have built and deployed a **server-side Meta Conversions API (CAPI) integration** for the Interconnected funnel. This means every opt-in lead and every Kajabi purchase now fires a conversion event directly from our server to Meta — not just from the browser pixel. We have also deployed a **server-side 50/50 A/B traffic split** on the main opt-in URL so we can test two page variants simultaneously.

This document explains exactly how the tracking works so the ad buying team optimizes against the right signals and does not accidentally interfere with the attribution system.

---

## 1. The Pixel Setup (What Existed Before)

**Pixel ID: 1498608757116877**

Before this work, the only tracking was a standard browser-side Meta Pixel that fires:

| Event | When It Fires | Where |
|---|---|---|
| `PageView` | On page load | All three pages (A, B, Thank You) |
| `Lead` | On the Thank You page load | `/interconnected/thank-you` |
| `InitiateCheckout` | When the visitor clicks the Buy button on TY page | `/interconnected/thank-you` |

**The problem with browser-only tracking:** Browser pixels are blocked by ad blockers, iOS privacy restrictions, and Safari's Intelligent Tracking Prevention (ITP). Industry estimates put browser pixel signal loss at 20–40% of real conversions. Meta's algorithm was therefore optimizing on an incomplete signal, which inflates CPL and reduces match quality.

---

## 2. What We Built: Server-Side CAPI

We built a custom server-side integration (`server/capiHelper.ts`) that sends conversion events directly from our Node.js server to Meta's Conversions API endpoint:

```
POST https://graph.facebook.com/v19.0/1498608757116877/events
```

This runs entirely on our server — it cannot be blocked by any browser extension, iOS setting, or ad blocker.

### 2a. CAPI Lead Event (Fires on Every Opt-In)

**When:** Immediately after a visitor submits the opt-in form on either Page A or Page B.

**What data is sent to Meta:**

| Field | What It Is | Why It Matters |
|---|---|---|
| `event_name` | `"Lead"` | Tells Meta this is a lead conversion |
| `event_time` | Unix timestamp of submission | Required |
| `event_id` | SHA-256 hash of `email + "Lead" + today's date` | **Deduplication key** — prevents double-counting |
| `action_source` | `"website"` | Required |
| `event_source_url` | `https://content.theurbanmonk.com/interconnected` | The page where the event occurred |
| `user_data.em` | SHA-256 hash of the lead's email (lowercase, trimmed) | **Primary match signal** |
| `user_data.ph` | SHA-256 hash of phone (digits only) | Secondary match signal (when provided) |
| `user_data.client_ip_address` | Visitor's real IP address (from `X-Forwarded-For` header) | Match signal |
| `user_data.client_user_agent` | Visitor's browser/device string | Match signal |
| `user_data.fbc` | Facebook click ID cookie (`_fbc`) or constructed from `fbclid` | **Strongest match signal when from paid ad** |
| `user_data.fbp` | Facebook browser ID cookie (`_fbp`) | Secondary match signal |
| `custom_data.campaign` | UTM campaign name | Attribution context |

**Important note on fbclid/fbp/fbc:** These are captured from the visitor's browser on the React version of the pages (Interconnected.tsx and InterconnectedB.tsx). The static HTML version of Page A (`interconnectedStaticPage.ts`) does not currently capture these signals — it only sends email, name, phone, and UTMs. **The server still has the visitor's IP address and user agent, which are captured server-side regardless of which page version is served.** The email hash alone is sufficient for Meta to match the event if the person is logged into Facebook/Instagram on that device.

### 2b. CAPI Purchase Event (Fires on Every Kajabi Sale)

**When:** Kajabi fires a webhook to our server at `POST /api/kajabi/purchase` whenever a purchase is completed.

**What data is sent to Meta:**

| Field | Value |
|---|---|
| `event_name` | `"Purchase"` |
| `event_id` | SHA-256 hash of `email + "Purchase" + kajabi_order_id` |
| `event_source_url` | `https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout` |
| `user_data.em` | SHA-256 hashed email |
| `user_data.ph` | SHA-256 hashed phone (looked up from our lead database) |
| `user_data.fbc` | `_fbc` cookie value (looked up from our lead database) |
| `user_data.fbp` | `_fbp` cookie value (looked up from our lead database) |
| `user_data.client_ip_address` | IP address (looked up from our lead database) |
| `custom_data.value` | Purchase amount in dollars |
| `custom_data.currency` | `"USD"` |
| `custom_data.content_name` | Offer name from Kajabi |
| `custom_data.order_id` | Kajabi order ID |

**The lead lookup:** When a purchase fires, we look up the buyer's email in our `interconnected_leads` database table to retrieve the `fbclid`, `fbp`, `fbc`, IP, and user agent that were captured when they originally opted in. This means even though Kajabi doesn't know about Meta click IDs, our system reconnects the purchase back to the original ad click.

**Kajabi webhook URL to configure:**
```
https://content.theurbanmonk.com/api/kajabi/purchase
```
This must be set in Kajabi Admin → Settings → Integrations → Webhooks. It fires on every `member_purchase` event.

---

## 3. Event Deduplication (Critical — Do Not Remove the Pixel)

Meta requires that when you send the same event from both the browser pixel AND CAPI, you use a matching `event_id` so Meta counts it as one event, not two.

**How our deduplication works:**

```
event_id = SHA-256(email + "Lead" + "2026-08-04")[first 32 chars]
```

1. **Server generates the `event_id`** when the form is submitted and fires the CAPI Lead event.
2. **Server returns the `event_id`** to the browser in the API response.
3. **Browser stores the `event_id`** in `sessionStorage` under the key `__capi_lead_event_id`.
4. **Thank You page reads the `event_id`** from `sessionStorage` and passes it to the browser pixel's Lead event:
   ```javascript
   fbq("track", "Lead", {}, { eventID: "abc123..." });
   ```

**Result:** Meta receives two Lead events with the same `event_id` — one from the browser, one from the server — and deduplicates them into a single conversion. The browser pixel is kept specifically for this deduplication handshake and for PageView tracking.

**Do NOT remove the browser pixel.** It is needed for:
- PageView tracking (CAPI does not fire PageView events)
- Event deduplication (the `eventID` parameter on `fbq("track", ...)` calls)
- Audience building (Custom Audiences from website visitors)

---

## 4. What Is Stored in Our Database

Every opt-in is saved to the `interconnected_leads` table in our database. This is a permanent backup that also stores all attribution signals for the purchase CAPI lookup.

| Column | What It Stores |
|---|---|
| `email` | Lead's email (lowercase) |
| `name` | Lead's name |
| `phone` | Phone number (if provided) |
| `sms_consent` | Whether they checked the SMS consent box |
| `utm_source` | e.g., `meta`, `facebook`, `instagram` |
| `utm_medium` | e.g., `paid`, `cpc` |
| `utm_campaign` | Campaign name from URL |
| `utm_content` | Ad set or ad name from URL |
| `referrer` | The page they came from |
| `page_variant` | `"A"` or `"B"` — which opt-in page they saw |
| `kajabi_tagged` | Whether Kajabi contact was created successfully |
| `klaviyo_synced` | Whether Klaviyo profile was created successfully |
| `capi_lead_sent` | Whether the CAPI Lead event fired successfully |
| `capi_lead_event_id` | The event_id used for deduplication |
| `fbclid` | Raw Facebook click ID from the ad URL |
| `fbp` | `_fbp` cookie (Facebook browser ID) |
| `fbc` | `_fbc` cookie (Facebook click ID cookie) |
| `client_ip` | Visitor's IP address |
| `user_agent` | Visitor's browser/device string |

Every Kajabi purchase is saved to the `kajabi_purchases` table:

| Column | What It Stores |
|---|---|
| `email` | Buyer's email |
| `amount_cents` | Purchase amount in cents |
| `offer_name` | Kajabi offer name |
| `funnel_source` | Always `"interconnected"` for this funnel |
| `kajabi_order_id` | Kajabi's order ID |
| `is_email_list_buyer` | Flag for manually-excluded email list purchases |
| `is_meta_attributed` | 1 if we found a matching lead record (i.e., they came through our funnel) |

---

## 5. The A/B Traffic Split

**As of August 4, 2026, the `/interconnected` URL splits traffic 50/50 between two opt-in page variants.**

### How It Works

1. A visitor clicks an ad and lands on `content.theurbanmonk.com/interconnected`
2. Our server checks for an `ic_variant` cookie
3. **New visitor (no cookie):** Randomly assigned A or B (50/50). Cookie set for 30 days.
4. **Returning visitor (has cookie):** Always gets the same page they were assigned before
5. **Page A visitors:** Served the current opt-in page directly at `/interconnected`
6. **Page B visitors:** Immediately 302-redirected to `/interconnected-b`

### What This Means for Ad Buying

- **Send all traffic to `/interconnected`** — the split happens automatically on our server. Do NOT split traffic manually in Meta Ads Manager by creating separate ad sets pointing to different URLs. That would break the experiment.
- **Both pages use the same pixel ID** (1498608757116877) and both fire the same Lead events to CAPI. Meta sees all leads from both pages as the same funnel.
- **The `page_variant` column** in our database tracks which page each lead came from, so we can compare opt-in rates between A and B in our Command Center dashboard.
- **The A/B split is for the opt-in page only** — both variants redirect to the same Thank You page at `/interconnected/thank-you`.

### Current Status (as of Aug 4, 2026)

- **554 leads total** — all currently tagged as Page A (the split was activated today)
- **Page B leads will start accumulating** as new traffic flows through the funnel
- **Statistical significance target:** 200 leads per variant before drawing conclusions
- The Command Center dashboard shows the live Page A vs B split in real time

---

## 6. What the Ad Buying Team Should Know

### Optimize Against These Events in Meta Ads Manager

| Priority | Event | What It Represents |
|---|---|---|
| 1 | `Purchase` (CAPI) | Actual Kajabi revenue — highest quality signal |
| 2 | `Lead` (CAPI + Pixel deduped) | Opt-in form submission |
| 3 | `InitiateCheckout` (Pixel) | Clicked the Buy button on TY page |

### Do NOT Do These Things

1. **Do not split traffic manually** by creating separate ad sets for Page A and Page B. The server handles the split automatically. Manually splitting would break our experiment and double-count leads.

2. **Do not remove the Meta Pixel** from the pages. It is needed for deduplication and audience building even though CAPI is the primary signal.

3. **Do not change the UTM parameter structure** without telling us. We use `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` to attribute leads in our database. If you change the naming convention, the attribution lookups break.

4. **Do not use a different pixel ID** on these pages. All three pages (A, B, Thank You) use pixel `1498608757116877`. Using a different pixel would cause deduplication to fail.

### What the CAPI Improves for You

- **Higher match rates** → Meta's algorithm has more signal to find people likely to convert
- **Lower CPL over time** → Better optimization means Meta spends more efficiently
- **Purchase signal** → When Kajabi fires the webhook, Meta gets the purchase event even if the buyer had an ad blocker or switched devices between opt-in and purchase
- **Accurate ROAS** → The Command Center pulls live Meta spend and matches it against Kajabi purchases with `is_meta_attributed=1` to show true funnel ROAS

### Current Known Gaps (Being Addressed)

1. **Static Page A does not send `fbclid`/`fbp`/`fbc` to CAPI** — The static HTML version of the opt-in page (which is what most visitors see) does not yet capture and forward the Facebook click ID cookies to the server. The CAPI Lead event still fires with the email hash and IP address, but the match quality is lower than it would be with the click ID. This will be fixed in a future update to add UTM + fbclid capture to the static page's form submission.

2. **Kajabi webhook must be configured** — The CAPI Purchase event only fires when Kajabi sends a webhook to `https://content.theurbanmonk.com/api/kajabi/purchase`. If this webhook is not yet configured in Kajabi Admin, purchase events will not reach Meta. **Action required: Configure this webhook in Kajabi.**

---

## 7. The Full Data Flow (End to End)

```
Visitor clicks Meta ad
        ↓
URL: content.theurbanmonk.com/interconnected
     ?utm_source=meta&utm_campaign=XYZ&fbclid=ABC
        ↓
Server assigns ic_variant cookie (A or B, 50/50)
        ↓
Page A: served directly        Page B: 302 redirect to /interconnected-b
        ↓                                      ↓
Browser pixel fires PageView           Browser pixel fires PageView
        ↓
Visitor fills out form and submits
        ↓
Browser sends POST to /api/trpc/interconnected.register
  → name, email, phone, smsConsent, UTMs, fbclid, fbp, fbc, pageVariant
        ↓
Server (interconnectedRouter.ts):
  1. Validates email (blocks disposable domains)
  2. Saves lead to interconnected_leads DB (with all attribution data)
  3. Creates Kajabi contact + applies "Interconnected Opt In" tag
  4. Syncs to Klaviyo (email list + SMS if consent given)
  5. Fires CAPI Lead event to Meta with SHA-256 hashed email + IP + fbc/fbp
  6. Returns { success: true, capiLeadEventId: "abc123..." }
        ↓
Browser receives capiLeadEventId
  → Stores in sessionStorage.__capi_lead_event_id
  → Redirects to /interconnected/thank-you
        ↓
Thank You page loads
  → Browser pixel fires Lead event with { eventID: "abc123..." } (deduplication)
  → Browser pixel fires InitiateCheckout when Buy button clicked
        ↓
Visitor purchases on Kajabi checkout
        ↓
Kajabi fires webhook to /api/kajabi/purchase
  → Server looks up lead record by email (gets fbclid, fbp, fbc, IP, UA)
  → Fires CAPI Purchase event to Meta with full user_data + value + order_id
  → Saves purchase to kajabi_purchases DB with is_meta_attributed=1
```

---

## 8. Monitoring and Verification

### Command Center Dashboard
URL: `content.theurbanmonk.com` → Owner login → "Interconnected HQ"

Shows in real time:
- Meta spend (filtered to Interconnected campaigns)
- Lead count, CPL, ROAS
- Kajabi revenue by tier ($67 OTO, $299 upsell, $297/$369 subscriptions)
- Page A vs B opt-in split
- A/B test on the Thank You page (Video A vs Video B)

### Meta Events Manager
In Meta Business Manager → Events Manager → Pixel 1498608757116877:
- You should see `Lead` events with `event_source: server` (CAPI) alongside `event_source: browser` (pixel)
- Deduplication is working when you see "Deduplicated" in the event breakdown
- Purchase events will appear when the Kajabi webhook is configured

### Verifying CAPI is Working
In Meta Events Manager, filter by "Connection Method = Server" to see only CAPI events. You should see:
- `Lead` events with match quality scores
- `Purchase` events after Kajabi webhook is configured

---

*Document prepared by the Urban Monk technical team. For questions about the implementation, contact the development team before making changes to pixel setup, UTM structures, or webhook configurations.*
