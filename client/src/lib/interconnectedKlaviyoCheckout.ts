export const INTERCONNECTED_67_CART_PERMALINK = "https://shop.theurbanmonk.com/cart/48959577653402:1";
export const INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT = "ty_b_klaviyo_v1_67_checkout";
export const INTERCONNECTED_199_CART_PERMALINK = "https://shop.theurbanmonk.com/cart/48994340077722:1";
export const INTERCONNECTED_KLAVIYO_199_CONTENT = "post_purchase_199_klaviyo_v1_checkout";

export function buildInterconnectedKlaviyoCheckoutUrl(search: string): string {
  const incoming = new URLSearchParams(search);
  const params = new URLSearchParams({
    destination: INTERCONNECTED_67_CART_PERMALINK,
    utm_source: "klaviyo",
    utm_medium: incoming.get("utm_medium") === "sms" ? "sms" : "email",
    utm_campaign: "interconnected_14day",
    utm_content: INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT,
  });
  const fbclid = incoming.get("fbclid");
  if (fbclid) params.set("fbclid", fbclid);
  return `/r/checkout?${params.toString()}`;
}

export function buildInterconnectedKlaviyo199CheckoutUrl(search: string): string {
  const incoming = new URLSearchParams(search);
  const params = new URLSearchParams({
    destination: INTERCONNECTED_199_CART_PERMALINK,
    utm_source: "klaviyo",
    utm_medium: incoming.get("utm_medium") === "sms" ? "sms" : "email",
    utm_campaign: "interconnected_14day",
    utm_content: INTERCONNECTED_KLAVIYO_199_CONTENT,
  });
  const fbclid = incoming.get("fbclid");
  if (fbclid) params.set("fbclid", fbclid);
  return `/r/checkout?${params.toString()}`;
}
