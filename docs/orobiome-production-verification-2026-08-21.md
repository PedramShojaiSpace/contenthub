# Orobiome Production Verification — Aug. 21, 2026

The production collector is now live. A deliberately invalid JSON POST to `https://content.theurbanmonk.com/api/orobiome/funnel-event` returned `400 application/json`, confirming the request reached the new Express receiver rather than the prior static HTML fallback. No test event was inserted during that check.

The public Shopify page had already been updated to include the approved persistent 50/50 control versus hero-offer-clarity assignment and its anonymous tracking script. The rendered browser view showed the approved treatment with the existing $399 partner package, confirmed inclusions, and the unchanged native Shopify call to action.

The protected `/hub/orobiome-funnel` route still displayed its full-screen loading state during live-browser verification. This is a dashboard rendering issue only; it does not alter the live product price, package, cart path, BixGrow attribution, or receiver availability. Further route and bundle diagnosis is required before the dashboard is declared verified.
