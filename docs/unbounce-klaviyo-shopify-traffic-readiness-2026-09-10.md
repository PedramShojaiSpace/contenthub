# Unbounce → Klaviyo → Shopify Traffic-Readiness Audit

**Date:** 2026-09-10  
**Mode:** Read-only preflight; no lead submission, message send, checkout, traffic activation, or external-system change.

## Initial Public-Route Findings

| Check | Observed state | Readiness implication |
|---|---|---|
| Owner-supplied URL | `https://try.theurbanmonk.com/interconnected-lp-3/continue` returns **“The requested URL was not found on this server.”** | **Launch blocker if this exact URL is used in ads.** It is not the live landing-page path. |
| Documented base page | `https://try.theurbanmonk.com/interconnected-lp-3/` resolves publicly and renders the Interconnected landing page. | This appears to be the actual acquisition-page URL and must be used as the candidate traffic destination unless the `/continue` route is intentionally created and published. |
| Visible form | Email is required; phone is optional; SMS consent is a separate unchecked checkbox labeled **“SMS Updates (optional)”**; a submit button is present. | The visible consent design does not infer SMS consent from phone presence. Backend enforcement and payload mapping remain to be verified. |
| Consent copy | The public page includes recurring automated marketing-text consent language and links to the Urban Monk privacy policy. | Consent copy is present; exact submitted field values and Klaviyo consent mapping remain to be verified. |

## Current Status

The exact URL supplied for traffic is presently a 404, while the trailing-slash base path is live. The audit must therefore treat URL correction as an immediate blocker and continue validating the live base page’s form submission target, redirect, downstream enrollment, alerting, and attribution configuration without submitting a real lead.

## Live LP-3 Configuration Observed in Public Markup

| Component | Live observation | Interpretation |
|---|---|---|
| Unbounce page identity | Page ID `9872b1ca-b228-46f8-b1fe-b3885c254663`, variant `E`, public URL `/interconnected-lp-3/`. | Matches the previously tested native-form page. |
| Native form completion action | The published form configuration uses `action: "url"` and redirects to `https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`; `includeFormData` is false. | The visitor handoff is configured correctly, but the public markup alone cannot prove the separate server-side Unbounce webhook remains active. |
| Meta browser tracking | Pixel `1498608757116877` loads and fires `PageView`. | Page-view tracking is present. Lead deduplication still depends on a successful first-party webhook or bridge path. |
| Legacy bridge script | A browser script still listens for Klaviyo embedded-form event ID `SJAKDW` and posts to `/api/interconnected/unbounce-lead`. | The visible page now uses a native Unbounce form, so this legacy listener is not the authoritative native-form delivery path. It should not be counted as proof of lead delivery. |
| Authoritative native receiver | The Content Hub exposes `/api/interconnected/unbounce-native-lead`, restricted to `/interconnected-lp-3`, with an authenticated webhook secret, email validation, explicit SMS-consent enforcement, `ko_klaviyo` lead persistence, Klaviyo list delivery, and deterministic Meta CAPI Lead deduplication. | The receiver code is present and appropriately scoped; current Unbounce server-side webhook attachment/delivery must still be reverified. |
| UTM handling | The native receiver reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `fbclid` from the submitted `page_url`. | The ad URL must carry these parameters, and Unbounce must send the complete landing-page URL in `page_url`. |
| Unbounce admin inspection | The connected browser reached the Unbounce sign-in page rather than an authenticated workspace. The available Unbounce connector is currently disabled. | Current webhook attachment, secret header, field mappings, and recent delivery logs cannot yet be certified from the provider control plane in this read-only pass. |

The prior verified mapping was `email → email`, `phone_number → phone`, and `sms_consent → sms_consent`, with a successful email-only test on 2026-08-20. That evidence is useful but is not a substitute for a current provider-side configuration read before new paid traffic.

## Current Provider and First-Party Evidence

| Layer | Current evidence | Readiness assessment |
|---|---|---|
| Unbounce publication | Provider API reports LP-3 published, no unpublished changes, last published `2026-09-08T21:41:02Z`, single serving variant `E` at 100%, and a form conversion goal. | Page publication and routing are stable. |
| Unbounce page stats | 57 visits, 15 visitors, 6 conversions, 40% visitor conversion rate. | The native form is registering conversions in Unbounce. This does not by itself prove downstream webhook delivery. |
| Unbounce integration health | A provider query filtered to `integration_errors: true` returns LP-3. | **Current warning/blocker:** Unbounce is flagging at least one lead integration on the page as erroneous. The provider tool does not expose the individual failing integration, so the page’s webhook/integration panel must be inspected before scale. |
| First-party native lead records | Since the latest LP-3 publication, the Content Hub has 7 `ko_klaviyo` records whose referrer is LP-3. The first was recorded 2026-09-09 09:22 CDT and the latest 2026-09-11 20:38 CDT. All 7 are marked `klaviyo_synced = true` and `capi_lead_sent = true`. | The page-specific native webhook has demonstrably succeeded after the latest publication, despite the provider’s integration-error flag. The flag may belong to another attached/legacy integration, but that cannot be assumed. |
| Production receiver | An unauthenticated POST to `/api/interconnected/unbounce-native-lead` returns HTTP 401. | The protected native receiver is deployed and enforcing its secret boundary. |
| Klaviyo flow | Direct read-only API check reports flow `YyFZPu` as live under the current name `[LIVE — STRICT 24H] Interconnected Free Screening - KO — APPROVED DESIGN`. The retrieved definition contains 21 top-level actions and 11 live message actions; Day 0 is live. | Klaviyo is sending-capable. The retrieved current flow differs from older 20-email/11-SMS inventory records, so the present definition—not older documentation—must govern launch assumptions. |
| Opt-in alerts | Project Heartbeat `lead-watchdog-hourly` is enabled on `0 0 * * * *`, with latest execution at `2026-09-13T17:00:30Z`. The five newest inspected runs all succeeded with HTTP 200 and returned `notification: hourly_summary_sent`. | Hourly owner summaries are operational. Individual opt-in alerts remain intentionally suppressed per owner instruction. |
| Meta spend filter | The current Interconnected reconciliation definition includes Meta campaign/ad-set names containing `agora` only. | A new paid campaign that does not include `agora` in either campaign or ad-set name will be omitted from the existing spend/CPL/ROAS dashboard. |
| Shopify funnel registry | The current `interconnected_agora` reconciliation definition sets `shopifyActive: false` and does not list the current `interconnected-the-complete-healing-protocol` product. | The existing Agora command-center revenue view is not ready to serve as the direct Shopify ROAS ledger for this new Unbounce/Klaviyo path. |
| Shopify webhook and attribution | The paid-order webhook has recorded 116 orders in the last 30 days, but none carried a directly matched click token. One recent Interconnected $67 order was recorded without UTMs or a click-token match. | Shopify order ingestion is alive, but the direct click-token/UTM link needed for clean campaign-level ROAS is not proven and currently shows zero direct matches. |

## Additional Launch-Critical Findings

### Klaviyo enrollment and delivery

The current flow trigger is a Klaviyo metric trigger filtered to `List = Interconnected Free Screening Opt-Ins`. The configured email list `Rrx44Q` exists under that exact name, and the native Unbounce receiver adds every accepted email lead to that list. The current flow definition has **11 live email actions and no SMS actions**. This differs from older sequence documentation and must be treated as the current source of truth.

For the period beginning with the latest LP-3 publication, Klaviyo reports **5 Day 0 recipients, 5 Day 0 deliveries, and 3 Day 0 clicks**. Across the flow, it reports 40 aggregate deliveries and 11 clicks. The same period contains 7 first-party LP-3 lead rows marked as Klaviyo-synced, leaving a **7-record versus 5-Day-0-recipient reconciliation gap**. This could reflect existing list membership, suppression, test profiles, or eligibility rules; it cannot be labeled harmless without a current unique-email controlled test.

The report also contains historical SMS message rows, but the present flow definition contains no active SMS actions. The audit therefore does **not** treat SMS as part of the current launch path.

### Shopify product and direct attribution

The live product is:

| Field | Current value |
|---|---|
| Product | Interconnected: The Complete Healing Protocol |
| Product ID | `9087631753370` |
| Variant ID | `48959577653402` |
| SKU | `UM-OTO` |
| Price | $67.00 |
| Availability | Available |

The first-party checkout bridge appends `attributes[_um_click_token]`, source, medium, campaign, and content to the Shopify **product-page URL**. However, the live Shopify product template does not copy `_um_click_token` into the add-to-cart form and contains no URL-to-cart-attribute handler. The token is present only in the browser URL and Shopify page analytics/localization return URL. Therefore it is not currently proven to survive Add to Cart → checkout → paid order.

That structural finding matches the stored evidence: the KO/Klaviyo checkout-touch table contains one recorded touch, but it has **zero matched orders and zero matched revenue**; the KO cohort-purchase ledger also contains zero rows. The paid-order webhook itself is current, but its present order matcher checks order note attributes/tags while the product page does not persist the query-string token into those locations.

### CPA and ROAS reporting

The Meta reporting credential is currently functional and returned recent campaign insights. The seven-day window inspected had $0 spend, so it proves connectivity rather than launch economics.

The existing Interconnected reconciliation dashboard is still configured for the Kajabi-era Agora path:

- Meta spend is included only when a campaign or ad-set name contains `agora`.
- The current Shopify product ID `9087631753370` is not in the registry.
- Shopify is explicitly inactive for the current `interconnected_agora` definition.
- The Klaviyo performance collector is hard-coded to the older flow `VMpbLV`, while the live launch flow is `YyFZPu`.
- Stored KO/Klaviyo snapshots therefore reference the old flow, not the current live one.
- The hourly opt-in summary counts all Interconnected leads together; it does not isolate LP-3/KO leads from Kajabi leads.

As configured today, the Content Hub can prove that LP-3 leads reached the database, Klaviyo, and Meta CAPI, but it **cannot yet produce a clean path-specific paid-media CPA or direct Shopify ROAS** for this launch.

## Launch Decision

> **NO-GO for scaled paid traffic.** The landing page and email path have positive functional evidence, but the exact advertised URL is wrong and the current attribution/reporting chain is not decision-ready.

The minimum blockers are:

1. **Use the live landing-page URL:** `https://try.theurbanmonk.com/interconnected-lp-3/`. Do not send traffic to `/continue` while it returns 404.
2. **Resolve Unbounce’s provider-side integration-error flag.** The native webhook has succeeded recently, but the page still appears in Unbounce’s `integration_errors` filter. Inspect the page’s Integrations panel and remove or repair only the failing/stale attachment.
3. **Reconcile 7 synced LP-3 records versus 5 Day 0 recipients.** Use one brand-new controlled email address, leave SMS unchecked, then verify Unbounce conversion, first-party lead row, Klaviyo list membership, Day 0 delivery, redirect, and CAPI acceptance.
4. **Persist the first-party click token through Shopify checkout.** The product template must transfer `_um_click_token` from the URL into a cart/order attribute, and the webhook should support the exact persisted location. Then verify one controlled checkout through order-paid read-back before relying on direct ROAS.
5. **Update the reporting source of truth.** The KO report must use flow `YyFZPu`, include product `9087631753370`, and remain separate from the Kajabi Agora ledger.
6. **Adopt a campaign contract.** A dedicated campaign/ad-set naming and UTM convention must isolate this Shopify/Klaviyo pilot. Reusing the existing `agora` filter would blend it with Kajabi spend and defeat the owner’s requirement to keep ledgers separate.
7. **Split lead alerts/reporting by path.** The hourly summary should show at least `ko_klaviyo` and `kajabi` counts separately if both funnels can receive traffic.

## Two Practical Launch Approaches

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **Small manual smoke test** | Correct the ad URL, resolve the Unbounce integration warning, and run a handful of controlled visits/leads while calculating spend and first-party leads manually. Fastest, but purchase attribution and ROAS remain incomplete until Shopify token persistence is repaired. | Low | Low |
| **Measured pilot with dedicated ledger** | Repair Shopify token persistence, update the live-flow/product reporting configuration, add path-specific lead counts, and verify one complete lead-to-paid-order chain before opening traffic. Slower to start, but produces defensible CPL, buyer CPA, and direct Shopify ROAS without contaminating Kajabi reporting. | Low engineering cost; no new platform required | Moderate |

The recommended approach is the **measured pilot with a dedicated ledger**. It matches the existing CRO rule that KO/Klaviyo/Shopify must remain a separate technical validation rather than being blended into the Kajabi price test.

## Controlled Activation Checklist

| Gate | Evidence required before traffic |
|---|---|
| Destination | Ad preview opens the base LP-3 URL with complete UTMs and no `/continue` suffix. |
| Native form | Unbounce Integrations panel shows the page-scoped webhook healthy with the expected email/phone/SMS mappings and secret header. |
| Consent | New test with phone but unchecked SMS remains email-only; a separate explicitly approved consent test is required before SMS is included. |
| Lead ledger | One new unique test creates exactly one `ko_klaviyo` first-party row with the supplied UTMs. |
| Klaviyo | The test joins `Rrx44Q` and receives Day 0 from live flow `YyFZPu`; no message is sent beyond the controlled test. |
| Thank-you page | Redirect lands on the active Klaviyo thank-you page without an expired state. |
| Shopify handoff | CTA reaches the $67 product with UTMs and a token that is persisted into cart/order metadata. |
| Paid-order webhook | A separately approved controlled order produces one deduplicated paid-order record and a direct click-token match. |
| Meta spend | Campaign/ad-set name and UTMs match the dedicated KO reporting contract; spend appears in the correct ledger only. |
| Reporting | Dashboard shows first-party LP-3 leads, Meta spend, CPL, Shopify paid orders, buyer CPA, revenue, and direct ROAS for the same Central-time window. |

## Interim Verdict

The acquisition and email handoff has real post-publication success evidence, and hourly summaries are functioning. However, **paid traffic should not be treated as fully measurement-ready yet** because: (1) the supplied `/continue` URL is a 404; (2) Unbounce currently flags an integration error; (3) seven synced leads reconcile to only five Day 0 recipients in the inspected window; (4) the current Shopify product template does not persist the first-party click token into cart/order metadata; (5) direct Shopify and KO cohort attribution currently contain no matched purchases; and (6) the current dashboards still point to the Kajabi-era Meta/product/flow configuration.

## Owner-Approved Remediation Progress — 2026-09-13

The formerly broken `https://try.theurbanmonk.com/interconnected-lp-3/continue` route has been repaired without moving or altering the live LP-3 page. An isolated Unbounce-managed page now owns that path and performs a browser-level forward to the live LP-3 base URL. A server-side 301 was tested first and immediately removed because it dropped query parameters. The published browser redirect was then verified with `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`; all four survived into the final LP-3 URL and the native form rendered. No lead was submitted.

The connected Unbounce API exposes the LP-3 page-level `integration_errors` flag but does not expose individual lead-integration inventory or repair operations. Clearing that warning therefore still requires an authenticated Unbounce web-editor inspection. The connected Shopify operations expose catalog, order, and general Admin GraphQL capabilities but no Online Store theme-file editor. Direct storefront script installation may therefore require either an authenticated Shopify theme-editor step or a storefront approach that does not depend on theme-file access.

The Shopify theme-file limitation has been removed from the critical path. The first-party checkout bridge now returns a short auto-submitting form for the isolated `ko_klaviyo` path. The form writes `_um_click_token`, `_um_funnel_path`, and the approved UTM fields to Shopify cart attributes through `/cart/update`, then returns the visitor to the unchanged Interconnected product page. Shopify carries these cart attributes into order `note_attributes`; the paid-order receiver validates the token and performs the existing exact click lookup. Kajabi paths and unrelated Shopify traffic retain their previous redirect behavior.

The reporting contract is now separated in code as `interconnected_ko_shopify`. It excludes Kajabi, maps only Shopify product `9087631753370`, uses deduplicated first-party LP-3 `ko_klaviyo` leads for CPL, and uses Shopify paid orders for revenue, buyer CPA, and ROAS. Meta spend is included only when the campaign or ad-set name contains one of the dedicated terms: `interconnected ko`, `interconnected_ko`, `interconnected-klaviyo`, or `interconnected shopify`. This prevents the KO/Shopify pilot from being blended with Agora/Kajabi spend.
