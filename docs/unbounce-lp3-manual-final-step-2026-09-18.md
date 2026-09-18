# LP-3 Meta Pixel and Lead Deduplication — Unbounce Final Step

**Page:** The Urban Monk - Interconnected Full Screening - Funnel LP copy 1  
**Live URL:** `https://try.theurbanmonk.com/interconnected-lp-3/`  
**Variant:** E  
**Pixel:** `1498608757116877`

## What is already verified

The public LP-3 source includes the correct Meta Pixel base code and a `PageView` call. The page also has the intended native Unbounce webhook, which posts to the Content Hub’s LP-3-only lead receiver. Historical Unbounce webhook errors were inspected: all three are old 502 responses dated August 22 or September 1, not a current production delivery failure.

The active issue is that **two custom JavaScript blocks both attempt to track the same form submission as a Lead**. This can inflate browser Lead counts or make browser and CAPI event IDs diverge. The repair is deliberately limited to retaining one canonical form-submit listener and removing the stale second listener.

## Exact Unbounce actions

1. In Unbounce, open **The Urban Monk - Interconnected Full Screening - Funnel LP copy 1** and click **Edit** on live variant **E**.
2. Open **Javascripts (6)** at the bottom of the Classic Builder.
3. Keep the Pixel base script containing both `fbq('init', '1498608757116877')` and `fbq('track', 'PageView')`.
4. Delete the entire stale script that contains `window.addEventListener('klaviyoForms'`.
5. Find the other lead-tracking script that contains both `form.addEventListener('submit'` and `form.dataset.umAttributionBridge`.
6. Replace the **entire contents of that script** with the contents of [the canonical LP-3 attribution script](/home/ubuntu/lights-on-optin/docs/unbounce-lp3-native-form-attribution-script.txt).
7. Keep its placement as **Before Body End** and ensure it applies to the main page / variant E.
8. Click **Save**, then **Republish**.

Do **not** change the form fields, page URL, redirect (`https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`), native webhook URL, webhook secret header, SMS checkbox, traffic allocation, or the Pixel base script.

## Resulting event contract

| Funnel step | Required event behavior | Authority / treatment |
|---|---|---|
| Unbounce page view | One browser `PageView` | Pixel `1498608757116877` |
| Successful LP-3 form submit | One browser `Lead` with an `eventID` | Canonical remaining form-submit script |
| Same successful form submit | One server-side CAPI `Lead` with the **same** `eventID` | Native Unbounce webhook → Content Hub |
| Klaviyo thank-you redirect | Page view only; **no extra Lead** | Content Hub thank-you route |
| Offer CTA | Browser `InitiateCheckout` | Content Hub thank-you route |
| Paid Shopify order | One validated server-side CAPI `Purchase`, using Shopify-paid order data | Shopify webhook / attribution receiver |

The Content Hub server repair is staged to accept the form’s hidden `um_event_id` and use that exact identifier for CAPI. The Klaviyo thank-you page repair is staged to stop emitting a second Lead after LP-3 already recorded one.

## Validation after the page is republished

A real submission would add a Klaviyo profile and can trigger the live Day 0 email flow. It therefore requires explicit owner approval before being run. Until that approval, validate only the public source and Meta Test Events `PageView`; do not submit the form with an email address.

When a controlled email-only validation is approved, use a new address, leave phone blank, leave SMS unchecked, and run it once. The acceptance criteria are one Unbounce form conversion, one Klaviyo email enrollment, zero SMS enrollment, one browser Lead, one CAPI Lead with the same event ID, one thank-you page view, preserved UTM/fbclid data, and no duplicate Lead.
