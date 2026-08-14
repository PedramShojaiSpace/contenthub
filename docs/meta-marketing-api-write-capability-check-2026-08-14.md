# Meta Marketing API Write-Capability Check

**Checked app:** `Urban Monk Ads Manager` — App ID `2150724875769823` — Published / Live — Business `Urban Monk Productions, Inc`.

## Observed behavior

The Content Hub can read Meta reporting, but its approved attempt to create the King and Queen paused draft returned:

> `Meta API error: (#3) Application does not have the capability to make this API call.`

No draft package was created and no active advertising changed.

## Required owner review

In the Meta developer app, review **Required actions** and the app’s Marketing API / App Review configuration. Confirm that the app has the `ads_management` permission required to create and manage ads for this ad account, and check the Marketing API Access Tier feature. Meta’s current documentation says that for an app managing an ad account it owns or has been granted access to, standard access to `ads_management` and the Marketing API Access Tier are required. [1]

The app is already published, but published status alone does not establish the API capability required for writes. The app dashboard is open at:

`https://developers.facebook.com/apps/2150724875769823/dashboard/`

## Source

[1] [Meta for Developers — Marketing API Authorization, updated May 5, 2026](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization)
