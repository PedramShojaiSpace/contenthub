# Dedicated Upstream Landing Project — Handoff Brief

## Purpose

Create a new, **public-only** project to own the legacy customer URL:

`https://upstream.theurbanmonk.com/`

This hostname appears throughout durable links such as e-books, YouTube descriptions, social content, and email templates. It must load a landing page for unauthenticated visitors. It must not depend on the Content Hub, Manus authentication, internal dashboards, or temporary GoDaddy forwarding.

> **Critical goal:** The clean root URL `https://upstream.theurbanmonk.com/` must render the Upstream sales page directly. It must never redirect a customer to a login screen.

## Current Customer-Safe Fallback

Until the dedicated host is live, the live customer page is:

`https://content.theurbanmonk.com/hub/growth/upstream`

This page has been verified in the owner browser. The legacy `upstream` hostname is currently isolated from the shared Hub and has a GoDaddy 301 forwarding record pointed to that fallback. GoDaddy HTTP forwarding works; GoDaddy HTTPS forwarding is waiting for its SSL certificate activation.

## Page to Rebuild Exactly

The canonical source is:

`/home/ubuntu/lights-on-optin/client/src/pages/UpstreamHome.tsx`

Build a standalone public landing page from this component. It needs only the visual landing page—not the Content Hub router, authentication system, database, dashboard shell, or private administrative routes.

### Existing page structure

| Section | Current content / behavior | Preserve in standalone page |
|---|---|---|
| Hero | “You Watched the Webinar. Now Choose Your Path Upstream.” with Interconnected Series branding and a blue/white visual treatment | Yes |
| Trust strip | Secure checkout, functional-medicine science, instant setup statements | Yes |
| Offer 1 | **The Course** — $299 | Yes, exact checkout below |
| Offer 2 | **The Test** — $399, including a coach consultation | Yes, exact offer and checkout below |
| Offer 3 | **The Upstream Bundle** — $499, highlighted as best value | Yes, exact offer and checkout below |
| FAQ and disclaimer | Current education, support, and health disclaimer language | Yes |
| Footer | The Urban Monk and support@theurbanmonk.com | Yes |

### Checkout URLs — Preserve Exactly

| Offer | Price | Customer checkout destination |
|---|---:|---|
| The Course | $299 | `https://theacademy.theurbanmonk.com/offers/U22Ue56J/checkout` |
| The Test | $399 | `https://theacademy.theurbanmonk.com/offers/Dbu2EDpX` |
| The Upstream Bundle | $499 | `https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout` |

Do **not** modify price, copy, package contents, button language, checkout destinations, product configuration, or offer status as part of this move.

## Tracking That Must Be Preserved Without Expansion

The existing public project includes the following global tracking configuration:

| System | Existing ID | Required treatment |
|---|---|---|
| Meta Pixel | `1498608757116877` | Preserve existing PageView and Upstream page ViewContent behavior; do not add a second pixel or new CAPI implementation. |
| Google Analytics 4 | `G-CXZK2Q275S` | Preserve current GA4 setup. |
| Google Tag Manager | `GTM-MTRVLTFX` | Preserve current container. |
| Existing page events | ViewContent on load and current CTA-scroll/click events | Carry over only after confirming event parity; do not redesign attribution or add new conversion events without separate approval. |

The standalone page must not include a Hub login, OAuth callback, private query, customer review/testimonial data, or synthetic conversion event data. It must be openly reachable at `/`.

## Asset Requirement

The current hero uses a background image currently referenced from:

`https://files.manuscdn.com/user_upload_by_module/session_file/310519663158996687/vYnRpSiyPgboLuko.jpg`

For the new web project, preserve visual parity but use the platform’s required durable static-asset flow: copy the source image into `/home/ubuntu/webdev-static-assets/`, upload it with the project asset uploader, and reference the returned durable web asset URL. Do not leave critical customer-facing media only in the new project source tree.

## Required Dedicated Project Architecture

| Requirement | Implementation boundary |
|---|---|
| Hosting | New standalone public website project; no database, user account, or dashboard is required for the landing page. |
| Entry route | Render the Upstream landing page at `/`. |
| Public access | No Manus auth/OAuth or protected route. |
| Redirect behavior | Do not use the shared Content Hub to redirect or render the page. |
| Query strings | Preserve incoming UTM, `fbclid`, and other query parameters in the browser URL; do not strip them before visitors reach checkout. |
| Validation | Test root URL, every checkout button’s destination, mobile layout, browser console, and the one existing Meta/GA/GTM setup before moving the domain. |

## Domain Cutover Checklist — Do Only When Standalone Page Is Verified

1. Build the standalone public page on its managed project domain and test it without signing in.
2. Confirm all three customer checkout buttons open the exact URLs listed above. Do not purchase or submit an order as part of the test.
3. In the new project’s **Settings → Domains**, add exactly `upstream.theurbanmonk.com` and obtain the project’s exact CNAME target.
4. In GoDaddy, remove the temporary **`upstream` forwarding record**. This removes the forwarding-service A records.
5. Update only the `upstream` DNS record to the exact CNAME target shown by the new project’s Domains panel (commonly `cname.manus.space`, but copy the panel value exactly).
6. Wait for the new project to show the green verified/connected domain state and valid TLS.
7. Confirm `https://upstream.theurbanmonk.com/` loads the public standalone page in an incognito window, without OAuth or a Hub route.
8. Keep the Content Hub and its `content` domain unchanged. Do not touch `ch`, `get`, `try`, `theacademy`, `shop`, offers, checkout logic, pixels, Kajabi, Shopify, or active Meta ads.
9. Only after external HTTPS verification, remove any temporary forwarding fallback that remains.

## Exact Prompt for the New Task

> Build a new, standalone **public-only Upstream landing-page project** for The Urban Monk. This project will ultimately own `https://upstream.theurbanmonk.com/`, so the root `/` must load for unauthenticated visitors without any Manus login, Content Hub, dashboard, user accounts, database, or OAuth. Rebuild the existing Upstream sales page from `/home/ubuntu/lights-on-optin/client/src/pages/UpstreamHome.tsx` with visual and copy parity. Preserve the three existing offers and checkout destinations exactly: (1) The Course $299 → `https://theacademy.theurbanmonk.com/offers/U22Ue56J/checkout`; (2) The Test $399 → `https://theacademy.theurbanmonk.com/offers/Dbu2EDpX`; (3) The Upstream Bundle $499 → `https://theacademy.theurbanmonk.com/offers/3zvkMvds/checkout`. Preserve the current Meta Pixel `1498608757116877`, GA4 `G-CXZK2Q275S`, and GTM `GTM-MTRVLTFX`, but do not add pixels, CAPI, customer reviews, synthetic events, altered offers, altered checkout links, or new medical claims. Use a durable project static asset for the existing hero image, not a source-tree asset. Preserve UTM and `fbclid` query parameters. Test the managed public domain, root route, mobile layout, browser console, and destination links before requesting domain cutover. Once verified, instruct me to attach only `upstream.theurbanmonk.com` to this new project and update only that GoDaddy DNS record after removing the temporary GoDaddy forwarding. Do not touch `content`, `ch`, `get`, `try`, `theacademy`, `shop`, Shopify, Kajabi, offers, active Meta ads, or any other domain.

## Current Scope Boundary

This document is a preparation and handoff only. It does not create a new project, move a domain, change GoDaddy forwarding, modify a customer-facing offer, edit advertisements, or publish a new landing page.
