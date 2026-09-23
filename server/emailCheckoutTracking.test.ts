import { describe, expect, it } from "vitest";
import { buildTrackedCheckoutDestination } from "./emailCheckoutTracking";

describe("buildTrackedCheckoutDestination", () => {
  it("adds UTMs and the click token to a Shopify checkout URL", () => {
    const url = new URL(buildTrackedCheckoutDestination({
      destination: "https://shop.theurbanmonk.com/cart/48994340077722:1",
      clickToken: "token123",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "interconnected_14day",
      utmContent: "d03_episode",
    }));
    expect(url.searchParams.get("utm_source")).toBe("klaviyo");
    expect(url.searchParams.get("attributes[_um_click_token]")).toBe("token123");
  });

  it("preserves the Klaviyo closing-touch UTMs on an allowed Kajabi checkout without Shopify cart attributes", () => {
    const url = new URL(buildTrackedCheckoutDestination({
      destination: "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout",
      clickToken: "token123",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "interconnected_14day",
      utmContent: "ty_b_klaviyo_v1_67_checkout",
    }));
    expect(url.hostname).toBe("theacademy.theurbanmonk.com");
    expect(url.searchParams.get("utm_source")).toBe("klaviyo");
    expect(url.searchParams.get("utm_content")).toBe("ty_b_klaviyo_v1_67_checkout");
    expect(url.searchParams.get("attributes[_um_click_token]")).toBeNull();
  });

  it("rejects an arbitrary redirect destination", () => {
    expect(() => buildTrackedCheckoutDestination({
      destination: "https://example.com/checkout",
      clickToken: "token123",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "interconnected_14day",
    })).toThrow("not permitted");
  });
});
