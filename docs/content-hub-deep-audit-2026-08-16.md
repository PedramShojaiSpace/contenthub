# Content Hub Deep Audit — 2026-08-16

## Scope and Status

This audit reviews the deployed Content Hub across shared route/bundle infrastructure, server and database health, production asset delivery, high-value tools, integrations, and scheduled reporting operations. The report distinguishes directly verified behavior from code-level findings and external integrations that require provider-side confirmation.

## Initial Shared-Platform Findings

| Area | Current finding | Confidence | Audit implication |
|---|---|---:|---|
| Development service | The local server is running and authenticated Buffer channel reads completed successfully in the current log. | High | The server is not broadly down. |
| Recent logs | The tail contains a historical `ELIFECYCLE` after successful Buffer reads; no matching live route stack trace was present in the observed tail. | Medium | The command failure needs source identification, but it is not yet evidence that all tools are failing. |
| Bundle architecture | Public, Core, Content, Growth, and Analytics are independently built SPAs. Recent work corrected known cross-bundle deep-link routing. | High | A broad route/navigation audit is required because a wrong bundle can show a blank shell without an API failure. |
| Remaining route risk | Independent review identified possible lingering in-app navigation that may bypass the shared bundle resolver, server fallback mismatches, and stale chunk recovery without cache busting. | Medium | These are tracked as route and asset-delivery risks pending source and production verification. |
| Navigation inventory | A source search found 49 internal `Link`, `setLocation`, and `window.location` navigation usages outside the shared resolver/sidebar. Several direct paths such as `/studio`, `/video-production`, `/viral-studio`, `/manychat-wizard`, and `/script-library` can cross bundle ownership. | High | This is the primary remaining blank-page regression risk: individual tools may work when entered directly but fail when opened from in-app links that retain the current bundle. |

## Production System Health Check

The production System Health route rendered successfully and resolved from the requested Core path into its Growth-bundle owner. Its live checks returned nine healthy integrations and two degraded states:

| Service | Status | Evidence | Audit interpretation |
|---|---|---|---|
| Shopify Paid-Order Webhook | Degraded | The last first-party attributed paid-order webhook was 41 days ago. | **High operational concern.** Shopify storefront access is healthy, but attribution based on inbound paid-order evidence is stale and must not be relied on as current order-proof until the webhook path is inspected. |
| Apollo API | Degraded | The key is configured, but the app deliberately avoids a live quota-consuming validation. | Expected limitation, not a confirmed outage. |
| WordPress, Meta Ads, Shopify Storefront, Kajabi, Klaviyo, Gmail, YouTube, Buffer | OK | Each returned a successful live health response. | Direct connectivity was verified at the service-health level. |
| Substack | OK | The session returned `Authenticated as unknown`. | Authentication exists, but identity reporting is weak and should be improved for operator confidence. |

## Reproduced Tool Failure

| Route tested | Expected owner | Observed result | Severity | Evidence |
|---|---|---|---|---|
| `https://content.theurbanmonk.com/hub/content/youtube-to-blog` | Content bundle | **Persistent blank screen.** The URL redirected to `/hub/youtube-to-blog`, then rendered only the page background and the browser extension overlay; the app root contained no tool content after a settled-page check. | Critical | Two production browser captures, including a post-settle view, showed no Hub UI or error surface. |

This is direct evidence that the prior routing repair did not cover Content-bundle ownership for this legacy-style `/hub/{tool}` route. The issue matches the user’s report that multiple tools appear not to load and now becomes the immediate diagnostic priority.

### Deployment Freshness Blocker

The legacy path was repaired both client-side and server-side, and the local production server bundle contains the alias middleware (`grep` found the `/hub/youtube-to-blog` literal in `dist/index.js`). However, a cache-busted live HTTP request still returns **HTTP 200** instead of the expected redirect and reports `last-modified: Sat, 15 Aug 2026 23:22:09 GMT`, predating the fresh build and later checkpoints. This is direct evidence that the public domain is serving a stale deployment artifact rather than the current source/build. Until the deployment platform publishes the fresh server bundle, the route fix cannot be verified live.

### Canonical Content Tool Check

The actual canonical Content route, `/hub/content/video-to-blog`, loaded successfully in production. It rendered the full **YouTube → Blog Pipeline** interface, reported an authenticated YouTube connection, and displayed recent pipeline items. This verifies that the underlying tool, its Content bundle, and its backend data call are operational. The blank-screen defect is therefore constrained to the legacy URL path and the stale deployed alias middleware, not the underlying workflow.

The Core client-side fallback was also validated locally: `/hub/youtube-to-blog` immediately changed to `/hub/content/video-to-blog`, confirming the legacy-root route resolver executes. The development preview then returned its generic public-app 404 because its Vite fallback does not emulate the production server’s multi-bundle static routing. This is a **development-preview limitation**, not evidence that the canonical production Content tool is unavailable.

### SEO Dashboard Check

The production Content SEO dashboard at `/hub/content/seo` loaded after its initial skeleton state and returned live Google Search Console data: weekly clicks and impressions, top keywords and pages, striking-distance opportunities, indexing controls, and a 20-post content-flywheel view. This confirms the Content bundle, dashboard shell, Google Search Console integration, and SEO data query are working on the canonical route.

### Reconciliation Dashboard Check

The Analytics reconciliation route loaded successfully, displayed saved-data-only behavior by default, and exposed the explicit **Refresh Meta (1 call)** control as designed. It did not make an automatic Meta request. The current selected-day state correctly disclosed that no saved Meta snapshot exists and that Shopify pulling for this funnel is disabled. This is not a blank-page defect, but it is a material reporting limitation: the page cannot show current Shopify revenue for the Interconnected Agora funnel until the supported Shopify path is explicitly enabled and reconciled.

### Email → Revenue Routing Defect

The path `/hub/growth/interconnected-email-revenue` rendered a blank shell. Source audit confirmed that the page had been registered only in the monolithic `App.tsx`, not in any Hub bundle, while the Growth bundle had no fallback component at all. The repair registers the dashboard in its Core owner bundle, classifies it explicitly as Core in the shared resolver, and adds the shared fallback to Growth. The resolver regression suite passes 6/6 after the change. Deployment validation remains pending a fresh full Hub build.

## Audit Method

The next stages will inspect server fallback rules and entrypoint integrity; search all navigation code for cross-bundle escapes; exercise representative Core, Content, Growth, and Analytics tools; test protected backend surfaces; and record any broken behavior with reproducible URLs, observed errors, and remediation priority.
