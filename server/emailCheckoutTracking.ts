const ALLOWED_CHECKOUT_HOSTS = new Set([
  "shop.theurbanmonk.com",
  "theurbanmonk.mykajabi.com",
  "theacademy.theurbanmonk.com",
]);

export function buildTrackedCheckoutDestination(params: {
  destination: string;
  clickToken: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
}): string {
  const url = new URL(params.destination);
  if (!ALLOWED_CHECKOUT_HOSTS.has(url.hostname)) throw new Error("Destination host is not permitted");

  url.searchParams.set("utm_source", params.utmSource);
  url.searchParams.set("utm_medium", params.utmMedium);
  url.searchParams.set("utm_campaign", params.utmCampaign);
  if (params.utmContent) url.searchParams.set("utm_content", params.utmContent);

  // Shopify carries cart attributes to the paid-order webhook, enabling direct
  // click-to-order attribution. Kajabi safely retains the UTM convention.
  if (url.hostname === "shop.theurbanmonk.com") {
    url.searchParams.set("attributes[_um_click_token]", params.clickToken);
  }
  return url.toString();
}
