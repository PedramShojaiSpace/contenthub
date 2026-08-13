import { describe, expect, it } from "vitest";
import {
  buildControlledEmailCheckoutLink,
  INTERCONNECTED_KAJABI_67_CHECKOUT,
} from "../client/src/lib/controlledEmailCheckoutLink";
import { INTERCONNECTED_67_CART_PERMALINK } from "../client/src/lib/interconnectedKlaviyoCheckout";

describe("Controlled Email Checkout Link Builder", () => {
  it("keeps Kajabi sequence links on the native Kajabi checkout with UTM tracking", () => {
    const url = new URL(buildControlledEmailCheckoutLink({
      source: "kajabi",
      medium: "email",
      content: "d03_episode",
      destination: INTERCONNECTED_KAJABI_67_CHECKOUT,
      baseOrigin: "https://content.theurbanmonk.com",
    }));

    expect(url.origin + url.pathname).toBe(INTERCONNECTED_KAJABI_67_CHECKOUT);
    expect(url.searchParams.get("utm_source")).toBe("kajabi");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("interconnected_14day");
    expect(url.searchParams.get("utm_content")).toBe("d03_episode");
  });

  it("keeps Klaviyo sequence links on the first-party bridge to the Shopify cart", () => {
    const url = new URL(buildControlledEmailCheckoutLink({
      source: "klaviyo",
      medium: "sms",
      content: "d10_offer",
      destination: INTERCONNECTED_67_CART_PERMALINK,
      baseOrigin: "https://content.theurbanmonk.com",
    }));

    expect(url.origin).toBe("https://content.theurbanmonk.com");
    expect(url.pathname).toBe("/r/checkout");
    expect(url.searchParams.get("destination")).toBe(INTERCONNECTED_67_CART_PERMALINK);
    expect(url.searchParams.get("utm_source")).toBe("klaviyo");
    expect(url.searchParams.get("utm_medium")).toBe("sms");
    expect(url.searchParams.get("utm_campaign")).toBe("interconnected_14day");
    expect(url.searchParams.get("utm_content")).toBe("d10_offer");
  });
});
