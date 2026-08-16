# Content Hub Deep Audit — Morning Report

**Audit date:** August 16, 2026  
**Scope:** Production Content Hub routes and bundles; shared client/server routing; critical tool workflows; connected-service health; test status; reporting and commerce dependencies.  
**Assessment:** **Operational, with targeted operational hardening remaining.** The Hub is not broadly down. Multiple canonical tools work in production, the previously missing public commerce contract is restored, the full automated regression suite is green, and a representative post-deployment production smoke suite has now passed. The prior deployment synchronization issue should remain monitored, but the previously affected legacy and cross-bundle routes checked below are live.

> **Bottom line:** The immediate user-facing failure is primarily a **routing and deployment-asset problem**, not a universal server or database outage. The architecture repair is in source and passes focused tests, but production has intermittently served older bundle assets after successful checkpoints. That is the first issue to close before treating the Hub as fully stable.

## Executive Health Summary

| Area | Status | What was verified | Operational conclusion |
|---|---|---|---|
| Core application server | **Healthy** | Local server and production system-health surface responded; no shared runtime stack trace was found in the reviewed current log tail. | The server is not broadly down. |
| Canonical Core tools | **Working** | `/hub/core/studio` rendered the full Creation Studio. | Core bundle can mount and retrieve representative tool data. |
| Canonical Content tools | **Working** | `/hub/content/video-to-blog` rendered the YouTube → Blog Pipeline; `/hub/content/seo` loaded live Search Console data. | Content bundle and major content-data calls work on canonical routes. |
| Canonical Growth tools | **Working with route caveat** | `/hub/growth/yt-analytics` loaded video metrics and populated rows. | Growth bundle works for existing canonical routes. |
| Analytics tools | **Working with data limitations** | `/hub/analytics/reconciliation` loaded saved data and exposed the explicit manual Meta refresh action. | Analytics bundle works; revenue completeness remains constrained by the Shopify setting. |
| Cross-bundle deep links | **Representative routes verified** | Legacy and canonical Core, Content, Growth, and Analytics routes loaded or redirected correctly in a production browser after the reported deployment. | Continue resolver migration for untested internal links; the high-value paths tested no longer blank. |
| Production deployment assets | **Published; representative routes verified** | Earlier cache-busted requests served old Hub entries; the platform subsequently reported a successful deployment and representative post-deployment route checks passed. | Monitor for recurrence and capture asset evidence if a new blank shell occurs. |
| Database connectivity | **Healthy** | Application health and multiple protected reporting tools loaded; current database-backed dashboards returned data. | No audit evidence of a database outage. |
| Connected services | **Mostly healthy** | WordPress, Meta Ads, Shopify Storefront, Kajabi, Klaviyo, Gmail, YouTube, Buffer, Pexels, DataForSEO, and Shopify order-reading tests succeeded. | Credentials/connectivity are broadly intact; see targeted exceptions below. |
| Automated email reporting | **Configured; first production run pending** | The KO/Klaviyo daily collector is registered with isolated path ownership. | It needs its first successful managed execution before becoming a fully proven operational control. |

## What Is Confirmed Working

The following were directly observed in production during the audit or verified through live integration tests.

| Tool or system | Canonical route / check | Verified behavior |
|---|---|---|
| YouTube Analytics | `/hub/growth/yt-analytics` | Redirected from the legacy Analytics path to its owning Growth bundle, loaded totals and video rows. |
| Creation Studio | `/hub/core/studio` | Rendered full tool interface and research/intelligence controls. |
| YouTube → Blog Pipeline | `/hub/content/video-to-blog` | Rendered authenticated YouTube state and recent pipeline items. |
| SEO Dashboard | `/hub/content/seo` | Loaded weekly clicks/impressions, keywords, pages, opportunities, and content-flywheel data. |
| Reconciliation | `/hub/analytics/reconciliation` | Loaded without automatically calling Meta; clearly offered **Refresh Meta (1 call)** and saved-snapshot behavior. |
| Tantra Quiz Funnel | `/tantra-funnel` → `/hub/analytics/tantra-funnel` | Loaded live funnel, Shopify-product, and recent-completion data after its initial request state. |
| Interconnected KO/Klaviyo Day 0 offer | `/interconnected/offer-ko` | Rendered the contextual $67 permanent-access offer and its Shopify checkout handoff. |
| Shopify storefront | Live smoke tests | Returned real catalog products and normalized storefront data. |
| Shopify order reader | Live smoke test | Authenticated and returned a verified Tantra Him order line item. |
| Connected platforms | System health / live tests | Meta, Kajabi, Klaviyo, Gmail, WordPress, YouTube, Buffer, Pexels, and DataForSEO authenticated or returned live responses. |
| Interconnected paths | Focused test suites | Thank-you, checkout tracking, lead deduplication, attribution isolation, and email-revenue window coverage passed. |
| Manual Meta refresh | Reconciliation tests | Saved-view reads are separated from explicit single-call Meta refresh action. |

### Post-deployment live-route verification

After the platform reported a successful deployment, two previously at-risk public routes were rechecked in an authenticated production browser session. Both behaved correctly rather than rendering a blank Hub shell.

| Direct URL opened | Observed production result |
|---|---|
| `/hub/youtube-to-blog` | Redirected to `/hub/content/video-to-blog` and rendered the connected YouTube → Blog Pipeline, including the URL input and recent pipeline items. |
| `/hub/analytics/interconnected-email-revenue` | Loaded the Email → Revenue interface at `/hub/interconnected-email-revenue`, showing the explicit 14-day collection contract, separate Kajabi and KO/Klaviyo columns, and no pooled ROAS. |
| `/hub/core/studio` | Rendered Creation Studio with research-intelligence gaps, platform controls, content-goal controls, and the generate-content surface. |
| `/hub/analytics/reconciliation` | Rendered Sales Reconciliation for the Agora-only Interconnected funnel, including custom date controls, saved-view refresh, and the explicit **Refresh Meta (1 call)** action. The page still correctly reports Shopify product mapping but disabled Shopify pulling for the current Agora view. |
| `/hub/growth/yt-analytics` | Rendered YouTube Analytics and completed its data load, showing 5.5K total views, five video rows, and the Video Performance, Comments, Headline Generator, Email Attribution, and Revenue Attribution surfaces. |
| `/hub/content/video-production` | Completed its initial loading state and rendered Video Production Studio, its five-step production workflow, a New Session control, and recent session records. |

The second result also confirms that the page’s live behavior preserves the stated attribution guardrail: Kajabi reporting remains distinct from KO/Klaviyo/Shopify data.

## Confirmed Defects and Risks

### 1. Production bundle publication was stale or inconsistent; representative production verification now passes — **Monitor**

The most important earlier finding was not a code syntax failure. The local staged production build completed after route fixes, and source inspections confirmed the fixes were included in local output. Yet cache-busted production requests had continued to receive older bundle entries whose modification time predated the later build and checkpoint. The platform subsequently reported a successful deployment, and a production browser smoke suite then verified the legacy YouTube-to-Blog redirect plus canonical Core, Content, Growth, and Analytics surfaces.

This causes a dangerous mismatch: a repair can be correct in source, pass its focused tests, and still not be available to users. It also explains why canonical pre-existing tools may work while a newly registered tool or alias remains blank.

**Impact.** Do not treat a successful source checkpoint alone as proof that a Hub-bundle repair is live. The current deployment passed its representative smoke suite, but the same verification discipline should be applied to future multi-bundle releases.

**Recommended action.** Monitor the next multi-bundle production release. If any blank shell returns, escalate using the exact evidence in `docs/content-hub-deep-audit-2026-08-16.md`: successful local staged build and checkpoint paired with a stale public entry asset on a cache-busted request. Require confirmation that all public, Core, Content, Growth, and Analytics artifacts are atomically rebuilt and published from the latest checkpoint.

### 2. Legacy and wrong-bundle routes can still blank until fresh bundles publish — **Priority 0**

The audit reproduced a blank legacy YouTube-to-Blog path. The underlying canonical workflow is healthy at `/hub/content/video-to-blog`; the blank page comes from the legacy `/hub/youtube-to-blog` path being served by a bundle that does not own the route.

Source-level protections are now in place: a shared ownership resolver, bundle fallbacks, a corrected Core mount base, full/nested path normalization, and a server-side alias. However, the production alias and newer route registrations remained unverifiable while stale assets were served.

**Impact.** Historical bookmarks, older documentation links, or any direct internal navigation that bypasses the resolver can still produce blank screens until deployment freshness is resolved.

**Recommended action.** After the hosting layer publishes fresh assets, run a scripted smoke suite against the legacy path plus canonical Core, Content, Growth, and Analytics routes. Keep the resolver regression tests as a release gate.

### 3. Cross-bundle navigation inventory remains large — **Priority 1**

The source audit found **49** internal usages of `Link`, `setLocation`, or `window.location` outside the shared resolver/sidebar. Direct paths including `/studio`, `/video-production`, `/viral-studio`, `/manychat-wizard`, and `/script-library` may cross bundle ownership depending on where the user clicks from.

**Impact.** The current fallback architecture reduces blank screens, but these direct navigations are a continuing regression surface.

**Recommended action.** Inventory and migrate these calls in batches to the shared Hub route resolver. Add a static test that rejects newly introduced direct Hub routes outside approved resolver utilities.

### 4. Shopify paid-order webhook evidence is stale — **Priority 1**

System Health marked the Shopify Paid-Order Webhook degraded because the last first-party attributed paid-order webhook was **41 days** old. The Shopify storefront and authenticated order reader are healthy, so this is not proof of a store outage. It is an attribution reliability problem.

**Impact.** First-party order attribution should not be treated as current real-time proof until the inbound webhook path is validated with a new controlled paid-order event or an equivalent confirmed production event.

**Recommended action.** Audit the Shopify webhook subscription, endpoint response history, and order-to-attribution recorder. Reconcile a recent real order against Shopify Admin and the Content Hub before using this signal to decide media spend.

### 5. Reconciliation lacks Shopify revenue for the current Agora view — **Priority 1**

The Reconciliation page is behaving as designed: it uses saved Meta data by default and only calls Meta when the owner selects **Refresh Meta (1 call)**. However, the selected Interconnected Agora view explicitly reports that Shopify pulling is disabled.

**Impact.** The page cannot yet show complete current revenue or ROAS for that funnel from Shopify. Its Meta lead and spend data may be useful, but financial conclusions remain incomplete.

**Recommended action.** Confirm the desired Shopify source and enable the supported, path-isolated revenue pull only after preserving the Kajabi-versus-KO/Klaviyo attribution boundaries.

### 6. Commerce tRPC contract was missing from the main app router — **Remediated during audit**

The audit found that the implemented `commerceRouter` was absent from the main `appRouter`, leaving `commerce.products.list` and `commerce.cart.create` unavailable despite the underlying Shopify storefront working. The router is now composed under `commerce`, and focused contract coverage confirms that the product, collection, and cart procedures are present.

**Follow-up.** Run a browser cart smoke test after the next verified fresh bundle publication. The repair does not change storefront navigation or payment behavior.

### 7. Commerce and stale-test cleanup — **Remediated**

The audit’s initial full Vitest suite showed seven failures total:

| Group | Failing tests | Interpretation | Repair order |
|---|---:|---|---|
| Commerce router missing composition | 4 | Real contract gap described above. | Fix first. |
| Meta creative catalog expectations | 2 | Tests expect old WebP names/six variants while current Tantra assets use newer naming/seven variants. | Update test fixtures after validating the current catalog is intentional. |
| Klaviyo Day 0 draft layout expectation | 1 | Test expects obsolete beige declaration after approved email treatment changes. | Update the assertion to the approved current visual contract. |

All seven are now remediated. The commerce router is composed into the public app router and its focused contract test passes. The Klaviyo Day 0 test now asserts the approved white shared-email frame and structural content width rather than obsolete visual/brand strings. The Meta catalog test accepts the approved Tantra JPEG convention and its seventh variant. The post-remediation full suite passed **149 test files, 1,524 tests, and 2 intentional skips**, with no failures.

### 8. Integration-health caveats — **Priority 2**

Apollo was marked degraded only because the health check deliberately does not spend quota on a live request. That is expected behavior, not a confirmed integration outage. Substack returned `Authenticated as unknown`, which verifies a usable session but gives operators poor confidence about which publication/account is active.

**Recommended action.** Add low-cost identity verification for Substack where permitted. Leave Apollo quota protection in place, but label it **“not actively probed”** rather than degraded if the product UI allows it.

### 9. Scheduled Email → Revenue collector needs first-run verification — **Priority 2**

The KO/Klaviyo collector is registered as a managed, isolated daily job with a completed-day reporting window. The job configuration and callback ownership are in place, but it had not yet completed its first scheduled production execution at audit time.

**Impact.** The dashboard is usable for manual snapshots now. Treat automatic refresh as provisional until its first job log and saved snapshot are confirmed.

**Recommended action.** Inspect the first job log, saved snapshot timestamp, row count, and path-isolation fields after the next scheduled run. Do not adjust Kajabi data from this collector; Kajabi remains a separate native-import path.

### 10. Tantra dashboard contains a legacy downstream stage and incomplete spend mapping — **Priority 2**

The Tantra Quiz Funnel itself works and returned 452 quiz starts, 272 completions, 170 email captures, and one verified $185 Shopify unit. However, its downstream stage is labeled **“Kajabi tagged (in sequence)”** and remains zero, despite Klaviyo being the target CRM path. The dashboard also returned zero matched Meta Tantra spend because it only includes campaigns or ad sets with “Tantra” in their names.

**Impact.** The dashboard is operational but can present a misleading downstream conversion story and an incomplete ROAS calculation.

**Recommended action.** Replace the Kajabi tag stage with a Klaviyo enrollment or event signal, and formally map current Tantra campaign IDs rather than relying solely on campaign naming.

## Testing and Build Health

The automated suite has broad coverage and includes live credential smoke tests. The initial audit run showed **7 failures**; all are now remediated. The latest full-suite run passed **149 test files and 1,524 tests**, with **2 intentional skips** and no failures. Focused route-resolver coverage passed after the cross-bundle repair; focused reconciliation, attribution, Interconnected, Tantra, Shopify-order, and integration tests also passed.

The production build process is a second operational risk. Hub Core rendering can be terminated under sandbox memory pressure when the local development watcher is running. A complete staged build succeeded after stopping the watcher and using a bounded 1.8 GB heap. This means the build is recoverable, but it is not yet robust.

| Build risk | Current mitigation | Required hardening |
|---|---|---|
| Hub Core build memory pressure | Stop the local dev watcher before full build; use bounded 1.8 GB heap; partitioned heavyweight creative routes into Content. | Run production builds in a clean isolated process or CI worker; fail clearly if generated bundles are incomplete; publish all bundles atomically. |
| Stale deployed assets | Cache-busting query checks exposed old public entries. | Add asset/version verification to the deployment pipeline and block “published” status until route-bundle hashes match the latest build. |

## Recommended Repair Order

| Order | Action | Why it comes first | Definition of done |
|---:|---|---|---|
| 1 | Browser-verify the restored `commerce` tRPC cart path. | The contract repair is code-verified; the owner-facing cart interaction still needs a fresh-bundle smoke test. | Cart operation succeeds without affecting storefront navigation. |
| 2 | Repair/validate the Shopify paid-order webhook. | Required for trustworthy revenue attribution and downstream ROAS. | A recent paid order appears in Shopify, the webhook recorder, and the path-isolated attribution view. |
| 3 | Migrate the direct internal navigation inventory to the shared resolver. | Prevents the next blank-page regression. | All Hub navigation uses approved resolver helpers or an explicit documented exception. |
| 4 | Confirm the first automated KO/Klaviyo reporting run. | Completes operational proof for downstream email reporting. | Managed job log and saved 14-day snapshot validate successfully with no path contamination. |

## Audit Evidence and Limits

This report distinguishes direct verification from source-level analysis. Canonical tool routes and live integrations named in the “confirmed working” table were actively checked. The browser connection failed during one attempted sidebar-click audit, so direct production routes and resolver tests were used instead for that portion of the assessment. The deployment freshness issue prevents final confirmation of fixes that depend on newer public Hub assets.

## Conclusion

The Content Hub has a healthy core: major integrations authenticate, canonical tools across the Core, Content, Growth, and Analytics bundles work, and the server/database are not showing a broad outage. The user’s blank-page experience is real, but it has a specific architectural cause: multi-bundle ownership and stale production asset publication.

The important business decision is to preserve the now-proven route and deployment discipline while closing the remaining attribution dependencies. The current route protections and restored commerce contract have passed automated coverage; the representative production smoke suite also passed. The next operational work is the cart-flow check, Shopify webhook evidence, direct-navigation hardening, and the scheduled KO/Klaviyo report before using the Hub as the single source of truth for revenue allocation and scaling.
