import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SHOPIFY_META_PURCHASE_AUTHORITY,
  shouldSendContentHubShopifyPurchaseCapi,
} from "./attributionRouter";

describe("Shopify-native Meta Purchase authority", () => {
  it("keeps Shopify Facebook & Instagram as the single Purchase source", () => {
    expect(SHOPIFY_META_PURCHASE_AUTHORITY).toBe("shopify_facebook_instagram");
    expect(shouldSendContentHubShopifyPurchaseCapi()).toBe(false);
  });

  it("does not send or retry a Content Hub Purchase CAPI event for Shopify orders", () => {
    const source = readFileSync(new URL("./attributionRouter.ts", import.meta.url), "utf8");
    const paidHandler = source.slice(
      source.indexOf("export async function handleShopifyOrderPaid"),
      source.indexOf("export async function handleShopifyOrderUpdated"),
    );
    const retryProcedure = source.slice(
      source.indexOf("retryCapi: protectedProcedure"),
      source.indexOf("// ── Express Route Handlers"),
    );

    expect(paidHandler).toContain("const capiSent = shouldSendContentHubShopifyPurchaseCapi();");
    expect(paidHandler).toContain("metaPurchaseAuthority: SHOPIFY_META_PURCHASE_AUTHORITY");
    expect(paidHandler).not.toContain("sendCapiPurchase(");
    expect(retryProcedure).toContain("disabled: true");
    expect(retryProcedure).not.toContain("sendCapiPurchase(");
  });
});
