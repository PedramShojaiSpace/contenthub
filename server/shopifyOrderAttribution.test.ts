import { describe, expect, it } from "vitest";
import {
  calculateShopifyOrderRevenueIncrease,
  extractShopifyClickToken,
  snapshotShopifyOrderRevenue,
} from "./shopifyOrderAttribution";

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

  it("normalizes an amended post-purchase order into the final revenue snapshot", () => {
    expect(snapshotShopifyOrderRevenue({
      total_price: "266.00",
      line_items: [
        { title: "Interconnected", quantity: 1, price: "67.00", sku: "IC-67" },
        { title: "Gut Permeability Test + Coach Call", quantity: 1, price: "199.00", sku: "FIT-22-OCUS-199" },
      ],
    })).toEqual({
      totalCents: 26600,
      lineItems: JSON.stringify([
        { title: "Interconnected", quantity: 1, price: "67.00", sku: "IC-67" },
        { title: "Gut Permeability Test + Coach Call", quantity: 1, price: "199.00", sku: "FIT-22-OCUS-199" },
      ]),
    });
  });

  it("credits only a positive post-purchase revenue increase", () => {
    expect(calculateShopifyOrderRevenueIncrease({
      priorTotalCents: 6700,
      updatedTotalCents: 26600,
    })).toEqual({ incrementalRevenueCents: 19900, hasRevenueIncrease: true });

    expect(calculateShopifyOrderRevenueIncrease({
      priorTotalCents: 26600,
      updatedTotalCents: 6700,
    })).toEqual({ incrementalRevenueCents: 0, hasRevenueIncrease: false });
  });
});
