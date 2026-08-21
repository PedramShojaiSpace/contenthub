# Content Hub Production Readiness & Backup Audit

> **Audit posture:** Read-only by default. Remediate only a verified, low-risk production defect after documenting scope and regression coverage. No funnel, price, checkout, affiliate, pixel, or CRM-flow changes are authorized by this audit alone.

## Scope

This audit evaluates the Urban Monk Content Hub’s repository integrity, reproducible build, automated tests, production routes and webhooks, integrations, database/migration continuity, scheduled work, and final backup readiness before the planned Manus service interruption.

## Phase 2 — Repository, Build, Dependencies, and Tests

| Area | Verified finding | Readiness assessment | Required follow-up |
|---|---|---|---|
| Repository | `main`, `user_github/main`, and `origin/main` are aligned at checkpoint `9e651152`. Working tree contains only the new audit tracker entry. `git fsck` completed object validation; it reports historical dangling objects but no repository corruption. | **Pass with backup caution.** | Do not prune dangling objects before the final backup; preserve all history until the exported Task Data snapshot is confirmed. |
| Dependency lock | `pnpm install --frozen-lockfile --offline --ignore-scripts` completed successfully without changing the lockfile. | **Pass.** | Retain both `package.json` and `pnpm-lock.yaml` in the final snapshot. |
| Production build | The custom staged build had completed successfully immediately before this audit: public, Hub core, Hub content, Hub growth, Hub analytics, and server bundles. | **Pass, but resource-sensitive.** | The build depends on a sequential custom driver and a constrained Node heap; retain the successful checkpoint and avoid concurrent browser/dev-server processes during a recovery build. |
| Full tests | Initial full run reported `174` test files passed, `1` failed, `1,593` tests passed, `2` skipped. The only failure was `shopifyWebhookSecret.integration.test.ts` because no local receiver was running at `127.0.0.1:3000`. Re-running that test after starting the development receiver passed. | **Pass with test-harness fragility.** | Treat the full test command as requiring the local receiver for this one integration test. Document this before recovery work; do not classify it as a production webhook failure. |
| Type checking | `pnpm check` was unable to complete within the available sandbox memory: TypeScript exhausted a 1.8 GB Node heap. | **Open tooling risk.** | There is no fresh whole-project TypeScript result. Use successful production builds and targeted type/test checks for recovery validation, then schedule type-check decomposition after continuity work. |
| Dependency security | Production dependency audit reports **88 advisories** across 970 production dependencies: **25 high**, **55 moderate**, **8 low**, and no critical advisories. High-risk items include Express’s legacy `path-to-regexp` chain; other findings sit in rich-content/rendering and transitive packages. | **Open security risk.** | Do not mass-upgrade dependencies immediately before backup. Triage high findings by exploitability and direct code use, then isolate dependency upgrades as a post-restoration stabilization branch unless a direct, safe patch is verified. |

### Build and Test Notes

The project uses `scripts/build.mjs` rather than the template’s default build command. It deliberately builds five frontend targets sequentially, renames each emitted HTML entry, clears stale split-bundle directories, and validates selected emitted chunks. This is necessary for the Hub’s split-bundle architecture but is operationally more sensitive than a standard single-bundle build. The successful build is a strong recovery baseline; the TypeScript memory failure is a separate developer-tooling issue, not evidence that the published application currently fails to build.

The project’s full test suite is broad and generally healthy. The Shopify signing-secret test is integration-shaped and expects a local development receiver. Its failure with the server stopped was therefore environmental; after the local receiver started, the signed malformed-payload safety test passed without recording an order or conversion event.

## Phase 3 — Production Routes, Funnels, Webhooks, and Integrations

| Area | Verified finding | Readiness assessment | Required follow-up |
|---|---|---|---|
| Public route reachability | The Content Hub home, Hub home, Orobiome analytics dashboard, Interconnected native-form test page, and Natalie Jill Oral affiliate page all returned HTTP 200 during the production probe. The Orobiome receiver rejects an invalid JSON event with HTTP 400 JSON, and an unknown `/api/*` POST now returns HTTP 404 JSON rather than the SPA HTML shell. | **Pass.** | Retain this route-probe list as a post-restoration smoke-test checklist. |
| Latency observation | Unauthenticated curl probes each took roughly five seconds end-to-end. This is a consistent platform/network observation, not yet a code-level diagnosis. | **Monitor.** | Repeat from a known external monitoring region after restoration; do not change caching or CDN configuration on this evidence alone. |
| Integration health | The live System Health dashboard resolved to 10 healthy checks and one degraded check. Shopify Storefront, Shopify Paid-Order webhook, Kajabi, Klaviyo, Meta, WordPress, Gmail, YouTube, Buffer, and Substack were reported connected. | **Pass with a visibility caveat.** | Re-run immediately after restoration because connector settings return disabled and must be manually re-enabled if the account is affected. |
| Apollo | Apollo is marked degraded because its key is configured but the dashboard intentionally does not execute a quota-consuming live validation. | **Known monitoring blind spot.** | Verify the first Apollo draw manually after restoration; no evidence currently shows a credential failure. |
| Shopify paid-order evidence | The health dashboard reported an attributed Shopify paid-order webhook received today. | **Pass.** | Preserve the current paid-order subscription and verify its first post-restoration event against the Content Hub ledger. |
| API fallback safety | A previous static-fallback risk was remediated and the current production probe confirms unknown API POSTs receive JSON 404 rather than HTML. | **Pass.** | Keep this behavior under regression coverage; it prevents a missed webhook route from appearing falsely successful. |
| Crawler response | `/robots.txt` currently returns the public SPA HTML document rather than a robots policy. There is no `client/public/robots.txt` file. | **Low-severity SEO/readiness defect.** | Add a minimal dedicated robots policy in the targeted remediation phase; this is safe and isolated. |

### Integration Health Limitations

The System Health view is useful but intentionally partial. It verifies configured credentials and selected lightweight calls; it does not prove that every downstream provider workflow will process a live object. Gmail, YouTube, Apollo, and Buffer require their workflow pages for deeper functional confirmation. The backup plan should therefore preserve their secrets and integration settings, followed by a post-restoration smoke checklist rather than assuming the green dashboard alone is sufficient.

## Phase 4 — Database, Migrations, Schedules, Configuration, and Continuity

| Area | Verified finding | Readiness assessment | Required follow-up |
|---|---|---|---|
| Database inventory | The live database contains 114 recorded Drizzle migration entries, 237 tables, 13 application users, 4,090 Interconnected lead records, and the newly created Orobiome event table. No personal records were extracted during audit. | **Pass.** | The final Task Data Backup is still required because code, schema history, and business data are point-in-time snapshots. |
| Orobiome event table | `orobiome_funnel_events` exists but correctly has zero rows; no synthetic shopper events were introduced after tracking launch. | **Pass.** | Validate against the first genuine visitor and native Shopify checkout after restoration. |
| Migration continuity | A recovery defect was found and repaired: `0123_add_orobiome_funnel_events.sql` now creates the base event table without `shopify_checkout_token`; `0124_add_orobiome_checkout_token.sql` creates that column exactly once. Focused migration-replay and Orobiome safeguards pass 4/4. With owner approval, the exact sequential schema operations also replayed successfully against an empty disposable table; the scratch table was then verified removed. The live application table and its data were not altered. | **Remediated and replay-validated.** | Preserve both migration files together in the final backup. |
| Migration layout | Drizzle’s configured output directory is the project-root `drizzle/`, while manually managed migrations live under `drizzle/migrations/`. The active schema is current, but this split layout is easy to misuse and contributed to migration-generator confusion. | **Process risk.** | Document the intended recovery order and avoid running an unreviewed migration generator during restoration. |
| Scheduled work | One active, noon-Central daily task is configured and last executed today. It calls multiple Content Hub endpoints, but only GitHub is listed as its connector. | **Continuity risk.** | The backup/restore plan must account for schedules and connectors being disabled after restoration; manually re-enable connectors and verify the daily task before relying on automation. |
| Connector context | The task configuration currently enables GitHub, My Browser, and Shopify. Application-level integrations continue to use managed project secrets and should be checked through System Health after restoration. | **Pass with restoration action required.** | Re-enable any restored third-party connectors and run the integration-health screen before campaign operations resume. |

## Phase 5 — Safe Remediations Completed

| Remediation | Validation | Customer-facing impact |
|---|---|---|
| Orobiome migration replay repair | Corrected the duplicate checkout-token definition across migrations `0123` and `0124`; file-contract safeguards and Orobiome regression coverage passed 4/4. The exact sequence also replayed successfully against an owner-approved empty scratch table, which was verified removed afterward. | None. No live business table or customer data was changed. |
| Dedicated crawler policy | Added `client/public/robots.txt` so the route is no longer served by the SPA fallback. The policy permits public crawl paths and excludes `/api/` and `/hub/`. The crawler-policy and Orobiome safeguards passed 5/5. | No funnel, page, checkout, or logged-in Hub behavior changed. |
| Final production build | A fresh staged build completed all public, Hub core, Hub content, Hub growth, Hub analytics, and server targets after the readiness remediations. | None. This is validation only until the checkpoint is saved. |

## Residual Risk Register

| Priority | Risk | Evidence | Recommended treatment |
|---|---|---|---|
| **P0 — Owner action** | Task Data is not automatically backed up. | Official guidance states that every export is a point-in-time snapshot and new orders, uploads, registrations, and generated artifacts after an export are not included.[1] | Create a fresh final Task Data Backup after the readiness checkpoint, verify the package exists, and preserve it unchanged. |
| **P0 — Restore procedure** | Restored third-party connectors must be manually re-enabled. | Official restoration guidance requires manual connector re-enablement after Task Data restoration.[2] | After restoration, re-enable connectors, then run System Health before traffic or automation resumes. |
| **P1 — Security backlog** | Production dependency audit reports 25 high and 55 moderate advisories, with no critical advisories. | The audit covers 970 production dependencies. | Do not mass-upgrade the dependency graph on the eve of a backup. Create a dedicated post-restoration hardening branch, beginning with direct/exposed dependency paths. |
| **P1 — Type-check capacity** | Whole-project `pnpm check` exhausts a 1.8 GB Node heap in the sandbox. | The full staged production build succeeds, but monolithic TypeScript validation does not complete in the same memory envelope. | Split TypeScript project references or run targeted checks after restoration. This is developer-tooling debt, not a current build failure. |
| **P1 — Test harness dependency** | One webhook integration test requires the local receiver at port 3000. | Full test run becomes 175/175 only when the dev server is active; otherwise it reports a connection refusal for the expected local endpoint. | Document the test prerequisite or refactor the test harness after the interruption. |
| **P2 — Automation continuity** | The single daily Content Hub schedule depends on the restored task environment and connector state. | It is active and ran today, but schedules/connectors need verification after restoration. | Check the schedule status, re-enable required connectors, and manually execute the endpoint sequence once after restoration. |
| **P2 — Monitoring blind spots** | Apollo’s status is deliberately degraded because a live quota-safe check is unavailable. Orobiome's new first-party dashboard is at a truthful zero state until real traffic arrives. | System Health reflects the Apollo monitoring limitation; no synthetic funnel event was inserted. | Verify the first Apollo draw and first genuine Orobiome page/checkout event after restoration. |
| **P3 — Performance observation** | Public curl probes were consistently near five seconds, and current generated entry bundles are substantial. | The fresh build emitted approximately 629 KB public and 911 KB Hub-core entry bundles before compression; Hub split bundles are operating correctly. | Establish an external synthetic monitor and schedule page-speed work after continuity is secured. Do not introduce cache changes on active opt-in pages during this freeze. |

## Final Backup Checklist

The official account notice and email are the source of truth for whether this project’s account is affected. If it is affected or uncertain, complete the checklist below before the published deadline. The published deadline is **August 23, 2026 at 7:59 a.m. SGT**; restoration opens **August 25, 2026 at 8:00 a.m. SGT**.[1]

| Step | Owner action | Completion evidence |
|---|---|---|
| 1 | Confirm the account’s notice and whether Account Info Backup is required in addition to Task Data Backup. | Notice/email reviewed; account type noted. |
| 2 | After this checkpoint is saved, open the [Data Backup Tool](https://manus.im/backup) and create a fresh **Task Data Backup**. For the broadest current snapshot: **Export task data → Export more → All tasks → All time → Start export**. | Completed export package appears in the chosen destination. |
| 3 | If this is a Type C account, create the Account Info Backup first, then create Task Data Backup. | Both packages present and complete. |
| 4 | Preserve the package names and contents exactly. Do not unzip, alter, mix split packages, or replace parts across export runs. | Package inventory recorded. |
| 5 | For this live site, create a second **final fresh export** as close as practical to the deadline if sales, leads, uploads, or content changes continue after the first export. | Timestamped latest package confirmed. |
| 6 | Preserve this readiness checkpoint and report alongside the backup package. | Checkpoint ID recorded with package inventory. |

## Post-Restoration Runbook

1. Restore the correct package set once the restoration window opens; restoration is a one-time action, so verify the chosen packages first.[2]
2. Re-enable restored third-party connectors and use the Content Hub System Health screen to confirm WordPress, Meta, Shopify, paid-order webhook, Kajabi, Klaviyo, Gmail, YouTube, Buffer, and Substack.
3. Confirm the daily Content Hub schedule is active, then manually run the documented endpoint sequence once and review its JSON responses.
4. Run the production smoke set: Content Hub home, `/hub/`, `/hub/analytics/orobiome-funnel`, Interconnected native-form test page, Natalie Jill oral route with `bg_ref`, invalid Orobiome event rejection, and unknown API JSON 404.
5. Validate the first genuine Shopify order, Interconnected lead, and Orobiome page/checkout event in their respective first-party reports. Do not insert synthetic customer data merely to satisfy the checks.
6. Create a fresh checkpoint only after the site is healthy and the post-restoration evidence is recorded.

## References

[1]: [Manus — How to Back Up Your Data](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)

[2]: [Manus — How to Restore Your Data](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)

## References

[1]: [Manus website backup guidance](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)

[2]: [Manus website restoration guidance](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)
