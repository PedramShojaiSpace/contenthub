# Tantra Meta Ads Manager Inventory Check

**Checked:** 2026-08-14 in the authenticated account `10207858653523297`.

## Observed current state

| Item | Finding |
|---|---|
| Content campaign | `DRAFT — UM — Tantra Content Education — Traffic — US` is present and marked **In draft**. |
| Review items | Ads Manager shows **12** items pending review/publish. |
| Visible Tantra ad | `DRAFT — Divorce — A — Big Decision` is present as an **In draft** ad. |
| Legacy `T-A` through `T-F` labels | No visible records matched those labels in the loaded Ads Manager table or page text. |
| Active-ads check | The interface did not reveal a separate active Tantra group from the visible campaign table; the visible content campaign remains draft. |

## Consequence

The approved content-first destination mapping is ready, but the exact six `T-A`–`T-F` records cannot be safely edited until their actual Ads Manager names or IDs are identified. Do not apply a speculative URL change to an unrelated active ad. The current known content campaign should remain draft until the owner/Curt has reviewed the actual ads and destination previews.

## Browser fallback draft — King and Queen

Because the Content Hub API draft creation is blocked, a browser-based duplication was created in Ads Manager as a saved **in-draft** object only:

| Object | Current saved name | ID |
|---|---|---|
| Campaign | `DRAFT — UM — King and Queen — Traffic — US` | `52524476029676` |
| Ad set | `DRAFT — Content — King and Queen — US — LPV` | `52524476029476` |
| Ad | `DRAFT — King and Queen — A — Rebuild the Field` | `52524476029876` |

The copied campaign remains off/in draft. It still inherits the Considering Divorce creative and destination until its ad-level URL and creative are deliberately changed. It must not be published before those replacement fields are verified.
