import { buildTrackedCheckoutDestination } from "./emailCheckoutTracking";

type ShopifyCartAttributionParams = {
  destination: string;
  clickToken: string;
  funnelPath: "ko_klaviyo";
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function hiddenField(name: string, value: string) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
}

export function buildShopifyCartAttributionHandoff(params: ShopifyCartAttributionParams) {
  const trackedDestination = buildTrackedCheckoutDestination(params);
  const destinationUrl = new URL(trackedDestination);
  if (destinationUrl.hostname !== "shop.theurbanmonk.com") {
    throw new Error("Shopify cart handoff requires the approved storefront host");
  }

  const returnTo = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
  const fields = [
    hiddenField("attributes[_um_click_token]", params.clickToken),
    hiddenField("attributes[_um_funnel_path]", params.funnelPath),
    hiddenField("attributes[_um_utm_source]", params.utmSource),
    hiddenField("attributes[_um_utm_medium]", params.utmMedium),
    hiddenField("attributes[_um_utm_campaign]", params.utmCampaign),
    ...(params.utmContent ? [hiddenField("attributes[_um_utm_content]", params.utmContent)] : []),
    hiddenField("return_to", returnTo),
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Opening secure checkout</title>
  <style>
    body{margin:0;background:#f7fbfc;color:#062b38;font-family:Arial,sans-serif}
    main{max-width:680px;margin:12vh auto;padding:32px;text-align:center}
    h1{font-size:28px;line-height:1.2;margin:0 0 12px}
    p{font-size:17px;line-height:1.55;margin:0 0 20px}
    button{border:0;border-radius:6px;background:#087e9d;color:#fff;font-size:17px;font-weight:700;padding:14px 24px;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <h1>Opening the secure Urban Monk store</h1>
    <p>Your checkout attribution is being preserved. You will continue automatically.</p>
    <form id="shopify-attribution-handoff" method="post" action="https://shop.theurbanmonk.com/cart/update">
      ${fields}
      <button type="submit">Continue</button>
    </form>
  </main>
  <script>document.getElementById("shopify-attribution-handoff").submit();</script>
</body>
</html>`;
}
