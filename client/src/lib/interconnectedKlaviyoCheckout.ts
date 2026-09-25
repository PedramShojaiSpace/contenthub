export const INTERCONNECTED_67_CART_PERMALINK = "https://shop.theurbanmonk.com/cart/48959577653402:1";
// The live Klaviyo thank-you treatment enters the verified Kajabi $99 offer.
// The first-party bridge retains the closing-touch attribution before redirecting
// to Kajabi, whose native purchase flow owns the downstream one-click upsells.
export const INTERCONNECTED_KLAVIYO_THANK_YOU_CHECKOUT_URL =
  "https://theacademy.theurbanmonk.com/offers/ofRhsQvo/checkout";
export const INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT = "ty_b_klaviyo_v2_99_checkout";
export const INTERCONNECTED_KLAVIYO_THANK_YOU_FUNNEL_PATH = "ko_klaviyo";
export const INTERCONNECTED_KLAVIYO_THANK_YOU_MESSAGE_KEY = "ty_b_klaviyo_v2_99_checkout";
export const INTERCONNECTED_199_CART_PERMALINK = "https://shop.theurbanmonk.com/cart/48994340077722:1";
export const INTERCONNECTED_KLAVIYO_199_CONTENT = "post_purchase_199_klaviyo_v1_checkout";

export function buildInterconnectedKlaviyoCheckoutUrl(search: string): string {
  const incoming = new URLSearchParams(search);
  const params = new URLSearchParams({
    destination: INTERCONNECTED_KLAVIYO_THANK_YOU_CHECKOUT_URL,
    utm_source: "klaviyo",
    utm_medium: incoming.get("utm_medium") === "sms" ? "sms" : "email",
    utm_campaign: "interconnected_14day",
    utm_content: INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT,
    funnel_path: INTERCONNECTED_KLAVIYO_THANK_YOU_FUNNEL_PATH,
    email_key: INTERCONNECTED_KLAVIYO_THANK_YOU_MESSAGE_KEY,
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
    funnel_path: INTERCONNECTED_KLAVIYO_THANK_YOU_FUNNEL_PATH,
    email_key: INTERCONNECTED_KLAVIYO_199_CONTENT,
  });
  const fbclid = incoming.get("fbclid");
  if (fbclid) params.set("fbclid", fbclid);
  return `/r/checkout?${params.toString()}`;
}
