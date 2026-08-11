import { describe, expect, it } from "vitest";
import {
  calculateCostPerPurchase,
  calculatePurchaseRate,
  calculateShopifySkuRoas,
} from "../client/src/lib/tantraFunnelFinancials";

describe("Tantra funnel financial calculations", () => {
  it("calculates Shopify SKU ROAS only when spend is available", () => {
    expect(calculateShopifySkuRoas(555, 185)).toBe(3);
    expect(calculateShopifySkuRoas(555, 0)).toBeNull();
  });

  it("calculates cost per paid product unit", () => {
    expect(calculateCostPerPurchase(370, 2)).toBe(185);
    expect(calculateCostPerPurchase(370, 0)).toBeNull();
  });

  it("calculates the paid-unit rate from captured emails", () => {
    expect(calculatePurchaseRate(3, 30)).toBe(10);
    expect(calculatePurchaseRate(3, 0)).toBeNull();
  });
});
