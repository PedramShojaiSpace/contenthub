# KO Meta Duplicate Worklog — 2026-09-18

## Owner-approved scope

The owner approved an equal-budget destination-path test at $55 per arm, or $110 per day across the existing Kajabi control and new KO challenger.

## Meta actions completed

The active Healthy Habits control campaign `52590299920405` was duplicated with all automated recommendations explicitly disabled. Meta created the unpublished challenger draft campaign `52532784816476` and ad set `52532784816276`.

The draft campaign was renamed **Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1 — Healthy Habits — Image**. The draft ad set was renamed **Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1 — Healthy Habits**. Meta displays preserved campaign-level daily budget of $55, Sales objective, website conversion location, maximize conversion value / Purchase, 7-day click / 1-day view attribution, United States, age 18–65+, Healthy Habits interest suggestion, and new-customer exclusions.

## Publish blocker

Meta’s reviewer reports one error: **Custom audience not available** (`#1359207`). The duplicate carries eleven customer-exclusion audiences. The visible list is:

1. HOT180 - Atrantil Purchases
2. HOT180 - Purchases - Resona Health Pixel
3. HOT180 - Urban Monk Purcahses
4. HOT180 - VIBE Purchases
5. HOT90 - All Urban Monk Purchases
6. Interconnected Total Lead List June 23rd 2025
7. [UMB] - Lead Day 7 - EXCLUDING BOOK PURCHASE
8. HOT180 - VIBE Purchases with Resona Health Pixel
9. Mental Health Reboot Purchasers
10. UM_Purchase_180
11. One further inherited exclusion is indicated by Meta’s count but is not shown in the current visible list.

The selected source campaign remains untouched. The KO challenger remains an unpublished Meta draft. The next required step is to remove only the unavailable inherited exclusion, then update the copied ad destination and UTM parameters before publishing. No traffic, budget, live destination, or experiment has changed yet.

## Pixel-access blocker discovered during duplicate setup

The live ads workflow is currently operating in ad account `10207858653523297`. In the duplicated challenger’s Dataset selector, the only available dataset is inactive **IC 2021** (`191779753163098`). Searching by the approved Urban Monk pixel ID `1498608757116877` returns **No matching results**.

Programmatic account inspection confirms the Urban Monk Pixel is active and firing, but it is owned by a different ad account, `1153114224705920`. The challenger therefore cannot be published correctly from the current Agora ad account until the Urban Monk Pixel is shared with `10207858653523297` in Meta Business Settings / Events Manager. This is an asset-permission change, not a tracking-code problem.

The draft is intentionally held unpublished. After pixel sharing, the remaining process is to select Urban Monk Pixel, resolve the one unavailable inherited suppression audience, set the KO destination and UTM parameters on the selected challenger ad, validate the draft, and publish the equal-budget test.

## Partner-access prerequisite

The approved pixel-assignment request was submitted through Meta's Business API and rejected with Meta error `200 / 1784039`: **Business does not have access to pixel or ad account.** Urban Monk Productions (`1153112761372733`) owns and can manage the Urban Monk Pixel, but Meta confirms it has no access to Agora ad account `10207858653523297`.

The owner of the business portfolio that owns the Agora account must first add **Urban Monk Productions, Inc.** as a partner on ad account `10207858653523297`, granting **Manage campaigns** / advertising use. This does not transfer ad-account ownership, billing, or current campaign management. Once that is complete, Urban Monk Productions can assign the Urban Monk Pixel to the existing Agora account; then the held KO draft can be finalized and published.

## Correction: campaign is already in the Urban Monk account

The owner clarified that **Agora** is a funnel label, not a separately owned Meta account. A direct Meta campaign read confirmed the live Healthy Habits control (`52590299920405`) belongs to the correct **Urban Monk - Facebook** ad account (`1153114224705920`). The initial cross-account draft (`52532784816476`) was therefore a navigation error and was deleted while still unpublished.

A new, correct Urban Monk-account A/B-test challenger was then created as campaign `52599171256405` and ad set `52599171258005`. Both are named **Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1 — Healthy Habits**. The copy preserves the $55/day campaign budget, Sales / website / Purchase value optimization, United States / 18–65+ audience controls, source exclusions, 7-day click / 1-day view attribution, source creative inventory, and the active **Urban Monk Pixel** with Purchase as the selected event. Meta schedules the native A/B test for seven days, beginning September 19 at 12:00 AM Pacific, with Cost per Website Purchase as the Meta experimental metric.

The new challenger is still unpublished. The remaining change is ad-level: update all copied ads to the approved Unbounce LP-3 URL and KO UTM contract, then run the approved email-only QA before publishing. Meta's browser experiment metric will be used only as an optimization signal; the documented first-party Kajabi/Shopify 14-day cohort comparison remains the decision authority.

## Publish-preflight status — 2026-09-18 evening

Meta’s draft review confirms the **Urban Monk Pixel** (`1498608757116877`) is selected with **Purchase** as the Website conversion event on the challenger. The campaign budget remains **$55/day**. The native Meta A/B panel pairs the live Healthy Habits Kajabi control with the KO challenger over September 19–26 Pacific Time; the test remains unpublished.

Meta marks the inherited **Mental Health Reboot Purchasers** exclusion as restricted for prohibited-information policy reasons. It was removed from the unpublished challenger only; no source/control setting changed. During this correction, the permitted `HOT180 - Atrantil Purchases` exclusion was inadvertently removed from the challenger and Meta’s existing-audience picker did not restore it in the authenticated session. The challenger therefore currently carries eight permitted exclusions instead of the control’s nine. This difference must be corrected or explicitly accepted before a strict targeting-parity test can be published.

Most importantly, the selected `1CONTROL Interconnected Image` review still displays the original Kajabi destination (`https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta`) and original URL tags. The challenger is consequently **not ready to publish**: all seven duplicated ads require the Unbounce LP-3 destination and the KO-specific UTM contract before delivery can begin. An attempted programmatic creative replacement cannot attach a creative to Meta’s unpublished duplicate ad IDs using the available API token; it made no live delivery changes. The destination updates must be completed in the authenticated Meta editor, followed by the previously approved no-charge email-only LP-3 QA and a final draft review.

## Destination migration complete — 2026-09-18, evening

All seven duplicated challenger ads were updated in the authenticated Meta editor. Their **Website URL** now points to Unbounce LP-3 and includes the shared KO tracking contract:

```text
https://try.theurbanmonk.com/interconnected-lp-3/?utm_source=meta&utm_medium=paid_social&utm_campaign=Interconnected%20KO%20IC-Destination-Test-Shopify-Challenger-v1
```

Each ad has a distinct `utm_content` identifier and display link `try.theurbanmonk.com`:

| Challenger ad | Ad ID | `utm_content` |
|---|---:|---|
| 1CONTROL Interconnected Image | `52599171256605` | `1control_interconnected_image` |
| 1VIDEO – Sora Video 2 of the Gut with Sound | `52599171256805` | `sora_gut_video` |
| Your Immune System Isn’t Attacking You | `52599171257005` | `immune_system_isnt_attacking_you` |
| Leaky Gut diagram, damaged vs healthy barrier | `52599171257205` | `leaky_gut_barrier` |
| Trailer with Bushel Behind Video REEL FORMAT | `52599171257405` | `trailer_bushel_video` |
| Even Healthy Foods Can Trigger Your Flares | `52599171257605` | `healthy_foods_flares` |
| 90% of Chronic Disease Starts in the Gut | `52599171257805` | `chronic_disease_gut` |

The browser editor visibly confirmed the correct **Urban Monk Pixel** (`1498608757116877`) and Unbounce LP-3 destination on the challenger drafts. Meta’s Graph API cannot read unpublished draft ad objects under the available token, yielding “Unsupported get request” for the draft IDs; this is a scope limitation of the token, not an indication that the browser-side draft updates failed.

### Updated publication gate

The challenger remains a **draft**. Before publication, retain the owner-approved equal split of **$55/day per arm** and complete these final checks:

1. In the Meta review pane, verify no required error remains other than the known placement limitation for the Sora video.
2. Resolve or explicitly accept the unintended missing permitted `HOT180 - Atrantil Purchases` exclusion described above, so the audience parity decision is deliberate and documented.
3. Use **Preview to publish** only to surface Meta validation. The external business decision remains first-party revenue, not Meta-reported purchase value.
4. Publish only if the total planned daily spend is exactly **$110 ($55 per arm)**, then run the already approved no-charge email-only LP-3 QA before allowing normal challenger traffic.
5. Score the result by 14-day source-separated cohorts: Kajabi cleared revenue for the control, Shopify paid/non-refunded revenue for KO, first-party lead count, qualified-lead rate, revenue per qualified lead, and booked ROAS. Do not choose a winner on Meta pixel value alone.

## Draft reset after final preflight — 2026-09-18, late evening

Before any publication, final QA found that the challenger ad set had drifted away from strict control parity while navigating Meta’s editor: it was temporarily set to **Website and calls**, the **Interconnected Series’s Pixel**, and maximize-conversions optimization. This was not acceptable for the destination-only comparison and no delivery occurred.

The affected challenger campaign `52599171256405` was therefore **deleted as an unpublished draft**. Meta immediately reduced the Urban Monk account’s campaign total from 1,938 to 1,937, confirming removal. No active control, budget, audience, pixel, spend, delivery, or published campaign changed.

The test is now deliberately reset rather than launched with contaminated configuration. The clean rebuild must preserve the control’s Website / Urban Monk Pixel / Purchase / maximize-conversion-value / 7-day-click-1-day-view configuration before any destination change is applied. The only treatment variable will then be the approved Unbounce LP-3 path and the documented KO UTM contract.

## Clean native A/B draft — 2026-09-18, late evening

A replacement **native Meta A/B test draft** was then created from the actual live Healthy Habits control in the correct Urban Monk – Facebook ad account (`1153114224705920`). Its test name is `IC-Destination-Test-Kajabi-vs-KO-v1`; its challenger is campaign `52599175312005` and ad set `52599175311805`. Both were renamed **Interconnected KO — IC-Destination-Test-Shopify-Challenger-v1**.

At creation, the challenger retained the control’s delivery configuration: **Sales**, **Website** conversion location, **Urban Monk Pixel**, **Purchase** event with Purchase value, **maximize value of conversions**, **7-day click / 1-day view**, the Healthy Habits audience controls, the inherited customer-exclusion set, and a **$55/day campaign budget**. The A/B test is a 7-day scheduled draft (September 19–26 Pacific) whose Meta-native diagnostic metric is CPC; independent first-party lead and booked-revenue measurement remains the economic winner authority.

No ad destination, conversion setting, audience, pixel, budget, or status of the live control was changed. The challenger remains **unpublished** while the KO landing-page destinations are applied and verified.

## Destination-edit note — 2026-09-18

The control-image challenger ad is presently configured as a **new ad** in Meta’s editor, not an existing-post-only placement. Meta exposes its **Create ad** setup, manual upload media configuration, and ad creative sections before the website destination fields. No destination was committed during this inspection; the live Kajabi URL remains intact for the control, and the KO challenger remains unpublished.

The Meta ad editor has now exposed the **Destination** section for the clean control-image challenger. The next required action is limited to replacing that draft ad’s website URL and display link with the approved LP-3 KO URL/UTM contract; this has not yet been committed.

The draft **1CONTROL Interconnected Image** and **Your Immune System Isn’t Attacking You** ads now have their website destinations set to LP-3 with the common `interconnected_ko_ic_destination_test_v1` campaign key and distinct `utm_content` values (`control_image` and `immune_system`). Both display links are `try.theurbanmonk.com`. These are draft-only changes; no live campaign has been published or altered.

The draft **Even Healthy Foods Can Trigger Your Flares**, **1VIDEO – Sora Video 2 of the Gut with Sound**, and **90% of Chronic Disease Starts in the Gut** ads were also switched to LP-3 using their respective `utm_content` labels (`healthy_foods`, `gut_video`, and `chronic_disease`). Display links on these draft ads are now `try.theurbanmonk.com`. No draft has been published.

## Native A/B test preflight — draft only

Meta’s native A/B-test setup confirms the challenger uses **Urban Monk Pixel** with the **Purchase** event, purchase-value optimization, `7-day click / 1-day view` attribution, and the copied customer-lifecycle exclusions (`HOT180 - Purchases - Resona Health Pixel` plus nine additional exclusions). The draft schedules the test for **September 19–26, 2026, Pacific Time**, with the original Healthy Habits campaign as control and the KO campaign as challenger. The native dashboard is presently configured to label the key metric as **CPC**. That is not the winner decision metric: the launch record must be evaluated on externally reconciled 14-day paid revenue, revenue per qualified lead, buyer CPA, and booked ROAS. The native test’s metric should be changed to a Purchase-oriented cost metric before publication if Meta permits it; all live traffic remains unchanged while this is a draft.

## Owner hold and final measurement rule — 2026-09-18

The owner instructed that **no challenger ad, ad set, campaign, or test may be published or turned on before manual review**. The challenger therefore remains an **unpublished draft**. The currently displayed native Meta key metric, **CPC**, is explicitly rejected as the final scorecard and must not determine the winner.

The authoritative comparison will use the documented first-party revenue ledger: **paid, non-refunded Kajabi revenue for the control and paid, non-refunded Shopify revenue for the KO challenger**, evaluated on matching cohorts and a shared post-click maturity window. The primary decision sequence is: (1) booked revenue per qualified lead, (2) booked ROAS using actual Meta spend, (3) buyer CPA, and (4) qualified-lead conversion rate. Meta Purchase/CPC reporting remains diagnostic only. No live delivery was changed after this instruction.
