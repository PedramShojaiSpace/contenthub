# VA Guide: Unbounce + Klaviyo + Meta Lead Tracking

**Page:** `https://try.theurbanmonk.com/interconnected-lp/`  
**Klaviyo form ID:** `SJAKDW`  
**Meta Pixel:** `1498608757116877`  
**Content Hub bridge:** `https://content.theurbanmonk.com/api/interconnected/unbounce-lead`

> **Purpose.** These two small additions create one Meta `PageView` when someone arrives and one deduplicated `Lead` only after the Klaviyo form is successfully submitted. Do not place either block inside the form body itself. Do not add quiz answers, health details, or SMS-consent fields to Meta.

## Step 1: Add the Meta Pixel base code

In Unbounce, open the Interconnected page and navigate to **Javascripts** or **Script Manager**. Add this as a new script, select **Head**, and set placement to **Before the closing `</head>` tag**. Apply it to **this page only**.

```html
<!-- Urban Monk Meta Pixel — Interconnected Unbounce page -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1498608757116877');
fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=1498608757116877&ev=PageView&noscript=1" />
</noscript>
```

## Step 2: Add the Klaviyo successful-submit Lead bridge

Add a **second** Unbounce script. Select **Before the closing `</body>` tag** and apply it to **this page only**. This script does not fire a Lead when the embedded form merely appears. It only fires after Klaviyo reports a successful main form submission.

```html
<!-- Urban Monk deduplicated Klaviyo form Lead bridge -->
<script>
(function () {
  var FORM_ID = 'SJAKDW';
  var PIXEL_ID = '1498608757116877';
  var BRIDGE_URL = 'https://content.theurbanmonk.com/api/interconnected/unbounce-lead';
  var fired = false;

  function getCookie(name) {
    var prefix = name + '=';
    return document.cookie.split(';').map(function (part) { return part.trim(); })
      .filter(function (part) { return part.indexOf(prefix) === 0; })
      .map(function (part) { return decodeURIComponent(part.slice(prefix.length)); })[0] || '';
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function makeEventId() {
    if (window.crypto && window.crypto.randomUUID) {
      return 'ub_ic_' + window.crypto.randomUUID().replace(/-/g, '');
    }
    return 'ub_ic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 14);
  }

  window.addEventListener('klaviyoForms', function (event) {
    var detail = event.detail || {};
    var formId = detail.formId || detail.formID;
    if (fired || detail.type !== 'submit' || formId !== FORM_ID) return;
    fired = true;

    var eventId = makeEventId();
    var meta = detail.metaData || {};
    var fbclid = getParam('fbclid');
    var payload = {
      eventId: eventId,
      formId: FORM_ID,
      email: meta.email || undefined,
      pageUrl: window.location.href,
      fbp: getCookie('_fbp') || undefined,
      fbc: getCookie('_fbc') || undefined,
      fbclid: fbclid || undefined,
      utmSource: getParam('utm_source') || undefined,
      utmMedium: getParam('utm_medium') || undefined,
      utmCampaign: getParam('utm_campaign') || undefined,
      utmContent: getParam('utm_content') || undefined
    };

    if (typeof window.fbq === 'function') {
      window.fbq('trackSingle', PIXEL_ID, 'Lead', {}, { eventID: eventId });
    }

    fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {
      // Do not interrupt a successful Klaviyo subscription if a tracking request is unavailable.
    });
  });
})();
</script>
```

## Step 3: Publish and validate without guessing

Publish the Unbounce page. Then use a **controlled test email address** that the team can recognize in Klaviyo. This creates a real opt-in, so do not use someone else’s address.

| Check | Expected result | Where to check |
|---|---|---|
| Chrome form load | The email field and submit button are visible | Chrome normal and Incognito window |
| Klaviyo form submit | One new/updated profile enters through form `SJAKDW` | Klaviyo profile activity and form analytics |
| Meta browser event | One `PageView` on load and one `Lead` after submit | Meta Events Manager → Test Events |
| Content Hub server event | One CAPI `Lead` uses the same event ID as the browser Lead | Meta Events Manager deduplication diagnostics and Content Hub logs |
| No duplicate Lead | Refreshing the page without submitting does not add Lead; one successful submit adds one Lead | Meta Test Events |

If the form fails in Chrome, test first in an Incognito window with extensions disabled. Then inspect Chrome DevTools → **Console** and **Network**, filtering for `klaviyo`. A request blocked by an extension should be allow-listed for both `try.theurbanmonk.com` and `static.klaviyo.com`.

## Do not change

Do not replace the existing Klaviyo loader or form container. Do not add `Lead` on page load, button click, `embedOpen`, or `stepSubmit`. Do not change the Shopify pixel. Do not add health, quiz, diagnosis, or SMS-consent data to the browser pixel or bridge payload.

## Why this is the correct event sequence

Klaviyo’s `submit` event fires once for the form’s main conversion action, while `stepSubmit` can fire more than once. Meta deduplicates a browser Pixel and Conversions API pair when both use the same event name and matching browser `eventID` / server `event_id`. [1] [2]

## References

[1] [Klaviyo Developers — Track Klaviyo form activity using JavaScript](https://developers.klaviyo.com/en/docs/track_klaviyo_form_activity_using_javascript)  
[2] [Meta Developers — Handling Duplicate Pixel and Conversions API Events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events)
