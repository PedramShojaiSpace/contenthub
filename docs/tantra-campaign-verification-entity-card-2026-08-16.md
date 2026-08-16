# Tantra Campaign Verification — Entity Card

| Field | Definition |
| --- | --- |
| Entity | The Urban Monk Tantra quiz funnel and its active US-only Meta paid-media campaign |
| Objective | Verify the relationship between qualified Tantra quiz leads, Shopify paid orders, and current Meta delivery before any pause decision |
| Reporting window | Campaign-to-date, anchored to live source timestamps on 2026-08-16 CDT |
| Revenue definition | Paid Shopify orders for the relevant Tantra Him and Tantra Her SKUs only; no inferred or modeled purchases |
| Lead definition | Completed Tantra quiz / qualified funnel submission records, separated from landing-page visits and link clicks |
| Spend definition | Meta delivery/spend limited to the approved Tantra campaign/ad set/ads; exclude Agora, VIBE, DSS, Interconnected, and all unrelated campaigns |
| Decision boundary | Do not change ads, budgets, audiences, checkout, product visibility, or attribution. Present a precise reversible pause scope for explicit approval if evidence supports it. |
| Sources | Shopify Admin order data, Content Hub Tantra funnel records, and the connected Meta delivery/reporting integration |

## Live Evidence Captured

As displayed by the authenticated Content Hub Tantra Funnel dashboard on 2026-08-16, the funnel has recorded 484 quiz starts, 296 completions, and 181 captured emails since launch. The dashboard reports one verified paid Shopify Tantra Him unit for $185.00 and a purchase rate of 0.6% of captured emails. Its saved Meta reconciliation display currently has no matched Tantra campaign spend or campaigns, so a current one-call Meta refresh is required before a delivery-state or pause recommendation can be made.

The connected Shopify Admin query returned no accessible order history, despite the dashboard’s verified product-line-item result. Therefore, the dashboard’s mapped paid-SEO data is the available first-party commercial record for this decision; the Shopify connector limitation is retained as a confidence caveat.

The Content Hub reconciliation page confirms that Tantra is configured as a Shopify-plus-Meta funnel and had no saved same-day Meta snapshot. The user-authorized on-demand one-call Meta refresh could not proceed because the server reported an existing refresh in progress; a direct snapshot check found no Tantra snapshot persisted. The development server was restarted to clear the stale in-memory guard, without changing ads or budgets. A subsequent browser reload reset the selector to Interconnected before a Tantra-only refresh could complete, so no additional Meta call was made.

## Reconciled Decision Evidence

At the user-authorized on-demand refresh, the selected Tantra funnel reported $23.89 of same-day Meta spend, 10 Meta-reported leads, $2.39 CPL, and $0.00 same-day recorded Tantra revenue. Six currently delivering Tantra campaign/ad-set records appeared in the snapshot: T-A, T-B, T-C, T-D, T-E, and T-F. The campaign-to-date product dashboard records exactly one paid Tantra Him unit worth $185.00. Across the recorded funnel, that is 0.5524% of captured emails (1 / 181), 0.3378% of completions (1 / 296), and 0.2066% of quiz starts (1 / 484). The campaign-to-date Meta spend value is not available in the saved record, so no campaign-to-date ROAS is calculated or inferred.

### Reversible Pause Scope

If explicitly approved, set the current delivery state to **PAUSED** for all six Tantra campaign/ad-set records visible in the verified snapshot—T-A through T-F—only. Do not alter Interconnected/Agora, VIBE, DSS, product pages, Shopify checkout, audience settings, creatives, tracking, or budgets outside those active Tantra records. The action is reversible by restoring `ACTIVE` to the same Meta objects after the video-first landing-page path is ready.

## Live Pause Execution Evidence

The authenticated Ads Manager showed six active Tantra records at execution time: T-A “Is Your Life Force Running on Empty?”, T-B “Why Don't I Want to Anymore?”, T-C “The Taoist Secret to Sexual Vitality”, T-D “Before You Call a Lawyer”, T-E “You Didn't Fall Out of Love”, and T-F “The Divorce Industry Doesn't Want You to Know This.” It also showed separate, already-paused legacy Tantra concepts and unrelated active Interconnected/Agora campaigns. The first approved pause action was initiated only on the active T-F record; the remaining five must be paused and then all six rechecked before reporting completion.

### Completed pause verification

Following the user’s explicit instruction to pause all six Tantra ads, each approved record was changed individually to **PAUSED** and re-read in the authenticated Ads Manager: T-F, T-E, T-D, T-C, T-B, and T-A. The manager displayed a successful confirmation after every status change, and all six selected Tantra records exposed **Activate** rather than **Pause**. The operation deliberately targeted no Shopify, checkout, audience, creative, tracking, or budget configuration. The final account summary changed from 19 to 4 active campaigns and some non-Tantra records displayed `IN_PROCESS`, so a direct identifier-level control check remains required before concluding that no unrelated campaign status changed.

### Identifier-level Meta status verification

A read-only Meta campaign status query confirms the six exact paused objects: T-F `52591069339605`, T-E `52591069324605`, T-D `52591069310805`, T-C `52590262032405`, T-B `52590262019805`, and T-A `52590261991605`. Each returns `status`, `effective_status`, and `configured_status` as `PAUSED`. Controls read without mutation include active Agora IDs `52591053911005`, `52590299929005`, `52590299927005`, `52590299926805`, `52590299921605`, `52590299921405`, `52590299921205`, `52590299921005`, `52590299920805`, `52590299920605`, and `52590299920405`; an active VIBE control ID `52568317422605`; and a paused DSS control ID `52530579602805`. This proves the six intended Tantra IDs are paused and establishes current non-Tantra control states; it does not create a historical before/after audit for campaign statuses modified independently by other operators.
