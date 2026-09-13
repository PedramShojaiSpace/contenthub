import { describe, expect, it } from "vitest";
import { buildShopifyCartAttributionHandoff } from "./shopifyCartAttributionHandoff";

describe("Shopify cart attribution handoff", () => {
  it("posts the first-party token and KO campaign fields into Shopify cart attributes", () => {
    const html = buildShopifyCartAttributionHandoff({
      destination: "https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol",
      clickToken: "0123456789abcdef0123456789abcdef0123456789abcdef",
      funnelPath: "ko_klaviyo",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "interconnected_14day",
      utmContent: "ty_b_klaviyo_v1_67_checkout",
    });

    expect(html).toContain('method="post" action="https://shop.theurbanmonk.com/cart/update"');
    expect(html).toContain('name="attributes[_um_click_token]"');
    expect(html).toContain('name="attributes[_um_funnel_path]" value="ko_klaviyo"');
    expect(html).toContain('name="attributes[_um_utm_campaign]" value="interconnected_14day"');
    expect(html).toContain("/products/interconnected-the-complete-healing-protocol?");
    expect(html).toContain("utm_source=klaviyo");
    expect(html).toContain("attributes%5B_um_click_token%5D=");
  });

  it("rejects a non-Urban-Monk Shopify destination", () => {
    expect(() => buildShopifyCartAttributionHandoff({
      destination: "https://example.com/products/interconnected",
      clickToken: "0123456789abcdef0123456789abcdef0123456789abcdef",
      funnelPath: "ko_klaviyo",
      utmSource: "klaviyo",
      utmMedium: "email",
      utmCampaign: "interconnected_14day",
    })).toThrow("not permitted");
  });
});
