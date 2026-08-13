import { INTERCONNECTED_67_CART_PERMALINK } from "./interconnectedKlaviyoCheckout";

export type ControlledEmailSequenceSource = "kajabi" | "klaviyo";
export type ControlledEmailMedium = "email" | "sms";

export const INTERCONNECTED_KAJABI_67_CHECKOUT =
  "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";

export const CONTROLLED_EMAIL_DEFAULT_DESTINATIONS: Record<ControlledEmailSequenceSource, string> = {
  kajabi: INTERCONNECTED_KAJABI_67_CHECKOUT,
  klaviyo: INTERCONNECTED_67_CART_PERMALINK,
};

function normalizeMedium(medium: ControlledEmailMedium): ControlledEmailMedium {
  return medium === "sms" ? "sms" : "email";
}

/**
 * Builds a CRM-specific Interconnected checkout link.
 *
 * Kajabi retains its native offer checkout and carries UTMs directly. Klaviyo/SMS
 * uses the first-party Shopify bridge so click tokens can be attached to the
 * Shopify order for direct paid-order attribution.
 */
export function buildControlledEmailCheckoutLink(params: {
  source: ControlledEmailSequenceSource;
  medium: ControlledEmailMedium;
  content: string;
  destination: string;
  baseOrigin: string;
}): string {
  const medium = normalizeMedium(params.medium);
  const content = params.content.trim() || "email_link";

  if (params.source === "kajabi") {
    const kajabiCheckout = new URL(params.destination || CONTROLLED_EMAIL_DEFAULT_DESTINATIONS.kajabi);
    kajabiCheckout.searchParams.set("utm_source", "kajabi");
    kajabiCheckout.searchParams.set("utm_medium", medium);
    kajabiCheckout.searchParams.set("utm_campaign", "interconnected_14day");
    kajabiCheckout.searchParams.set("utm_content", content);
    return kajabiCheckout.toString();
  }

  const bridgeParams = new URLSearchParams({
    destination: params.destination || CONTROLLED_EMAIL_DEFAULT_DESTINATIONS.klaviyo,
    utm_source: "klaviyo",
    utm_medium: medium,
    utm_campaign: "interconnected_14day",
    utm_content: content,
  });
  return new URL(`/r/checkout?${bridgeParams.toString()}`, params.baseOrigin).toString();
}
