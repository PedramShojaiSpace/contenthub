import { describe, expect, it } from "vitest";
import { extractShopifyClickToken } from "./shopifyOrderAttribution";

const token = "0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Shopify paid-order click-token extraction", () => {
  it("reads the cart attribute from Shopify note_attributes", () => {
    expect(extractShopifyClickToken({
      note_attributes: [{ name: "_um_click_token", value: token }],
    })).toBe(token);
  });

  it("uses the legacy tag fallback when the note attribute is absent", () => {
    expect(extractShopifyClickToken({ tags: `customer, um_ct_${token}, launch` })).toBe(token);
  });

  it("rejects malformed or truncated tokens", () => {
    expect(extractShopifyClickToken({
      note_attributes: [{ name: "_um_click_token", value: "not-a-token" }],
      tags: "um_ct_deadbeef",
    })).toBeNull();
  });
});
