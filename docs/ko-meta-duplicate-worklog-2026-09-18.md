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
