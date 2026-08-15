# Unbounce / Klaviyo Interconnected Landing-Page Audit

**URL:** https://try.theurbanmonk.com/interconnected-lp/  
**Initial Chrome observation:** August 15, 2026

## Initial live rendering result

The landing page rendered in Chrome through the connected browser. Above the fold, the Interconnected visual header, Wistia video player, first-name and email fields, SMS consent checkbox, and legal-consent copy were visible. The Wistia player displayed normally with active controls.

The browser’s text extractor did not expose the form or script internals, so the next audit step is a source-level inspection of the Unbounce page and a controlled form-load/submit-path review. This observation alone does not confirm pixel coverage, Klaviyo form event behavior, or Chrome reliability across local extensions and privacy settings.

## Source-level findings

The public HTML contains the expected Klaviyo onsite loader and embedded form container:

```html
<script async type="text/javascript" src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=XiGgUa"></script>
<div class="klaviyo-form-SJAKDW"></div>
```

The Klaviyo JavaScript URL returned `HTTP 200` from an independent request. The connected Chrome browser rendered the form above the fold. That establishes that the page and Klaviyo asset can load normally in Chrome; it does **not** reproduce the reported failure.

The public page source contained **no Meta browser Pixel script**, no Urban Monk pixel ID `1498608757116877`, and no standard browser `PageView`, `Lead`, or `CompleteRegistration` call. Consequently, this new Unbounce page is not presently training or reporting through the Urban Monk Meta Pixel from the page itself.

## Launch-critical corrections

### 1. Add the Urban Monk browser Pixel on the Unbounce page

Add the standard Meta Pixel base code for pixel ID `1498608757116877` to the Unbounce page header, before the Klaviyo form code. It must include a `PageView` event. This page-level addition does not change the Shopify storefront pixel.

### 2. Trigger a deduplicated Lead only after a successful Klaviyo submission

Do **not** fire `Lead` merely because the form appears. Attach the conversion only to Klaviyo's successful-submit callback. To keep browser and server reporting from creating the same double-counting problem just repaired on the Content Hub funnel, the browser and server must share one `eventID`.

The Unbounce page needs a small bridge that, on a Klaviyo success event, creates one event ID, calls the browser pixel with that ID, and posts the same ID plus the normalized email to a new Content Hub CAPI bridge endpoint. The endpoint then sends the server CAPI Lead with that same ID.

Klaviyo documents a `klaviyoForms` browser event and recommends its `submit` type when tracking a form's main conversion action because it fires once per form. Meta documents deduplication by using the same browser `eventID` and server `event_id` with the same event name. [1] [2]

The Unbounce team can use this **form-success listener pattern** after the Pixel base code and the Content Hub bridge endpoint are available. It deliberately sends no quiz, health, or SMS-consent detail to Meta.

```html
<script>
window.addEventListener('klaviyoForms', function (event) {
  if (event.detail.type !== 'submit' || event.detail.formId !== 'SJAKDW') return;

  const eventId = 'ub_ic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  if (typeof fbq === 'function') fbq('trackSingle', '1498608757116877', 'Lead', {}, { eventID: eventId });

  fetch('https://content.theurbanmonk.com/api/interconnected/unbounce-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: eventId, email: event.detail.metaData && event.detail.metaData.email })
  }).catch(function () { /* Browser Lead remains available if the bridge is temporarily unavailable. */ });
});
</script>
```

> Do not paste this listener until the Content Hub bridge endpoint is deployed. The listener is intentionally constrained to Klaviyo form `SJAKDW` and the one `submit` event so a page view, form render, or repeated form step cannot create a false Lead.

### 3. Make the Chrome failure diagnosable

Because the page rendered correctly in the connected Chrome browser and the Klaviyo loader returned HTTP 200, the reported failure is more likely to be intermittent or local to a specific Chrome profile than a universal page outage. Before launch, test the exact affected Chrome profile in this order:

1. Incognito window with all extensions disabled.
2. A normal window with privacy/ad blockers disabled for `try.theurbanmonk.com` and `static.klaviyo.com`.
3. DevTools Console and Network filtered for `klaviyo`, recording any blocked request or JavaScript error.
4. Hard refresh after clearing site data for `try.theurbanmonk.com`.

If the form fails only with an extension enabled, it is a local blocker issue. If it fails in a clean incognito profile, send the console error and blocked-request detail to the page team; that will identify the exact Unbounce or Klaviyo conflict.

## Important copy and policy observations

The public page contains substantial legacy disease-treatment language such as “reversing chronic disease,” “cancer,” and references to doctors healing chronic diseases. The page has an education-only disclaimer, but its claims should be reviewed before paid traffic is sent, particularly if the ads or landing-page review process requires claim substantiation.

## Current launch assessment

| Area | Status | Required action |
|---|---|---|
| Page rendering in independent Chrome | Pass | No universal form-load failure reproduced |
| Klaviyo form loader | Pass | Script endpoint returned HTTP 200 |
| Form-success submit path | Not tested | Test with a controlled seed record only after confirming the desired destination/list behavior |
| Urban Monk Meta PageView | Missing | Add browser Pixel base code |
| Deduplicated Meta Lead | Missing | Add success-event/CAPI bridge using a shared event ID |
| Chrome incident diagnosis | Pending | Test the affected profile with extensions off and inspect Network/Console |
| Claim review | Pending | Review legacy disease-treatment language before paid scaling |

## References

[1] [Klaviyo Developers — Track Klaviyo form activity using JavaScript](https://developers.klaviyo.com/en/docs/track_klaviyo_form_activity_using_javascript)  
[2] [Meta Developers — Handling Duplicate Pixel and Conversions API Events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events)  
[3] [Meta Developers — Conversion Tracking](https://developers.facebook.com/documentation/meta-pixel/implementation/conversion-tracking)
