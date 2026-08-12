import { describe, expect, it } from "vitest";
import {
  INTERCONNECTED_67_CART_PERMALINK,
  INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT,
  buildInterconnectedKlaviyoCheckoutUrl,
} from "../client/src/lib/interconnectedKlaviyoCheckout";

describe("Klaviyo Thank You B treatment checkout handoff", () => {
  it("uses the first-party bridge and the direct $67 Shopify cart permalink", () => {
    const url = new URL(buildInterconnectedKlaviyoCheckoutUrl("?utm_medium=email&fbclid=meta-click"), "https://content.theurbanmonk.com");
    expect(url.pathname).toBe("/r/checkout");
    expect(url.searchParams.get("destination")).toBe(INTERCONNECTED_67_CART_PERMALINK);
    expect(url.searchParams.get("utm_source")).toBe("klaviyo");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("interconnected_14day");
    expect(url.searchParams.get("utm_content")).toBe(INTERCONNECTED_KLAVIYO_TREATMENT_CONTENT);
    expect(url.searchParams.get("fbclid")).toBe("meta-click");
  });

  it("allows only the approved Klaviyo email or SMS close channels", () => {
    const sms = new URL(buildInterconnectedKlaviyoCheckoutUrl("?utm_medium=sms"), "https://content.theurbanmonk.com");
    const unsupported = new URL(buildInterconnectedKlaviyoCheckoutUrl("?utm_medium=paid_social"), "https://content.theurbanmonk.com");
    expect(sms.searchParams.get("utm_medium")).toBe("sms");
    expect(unsupported.searchParams.get("utm_medium")).toBe("email");
  });
});
