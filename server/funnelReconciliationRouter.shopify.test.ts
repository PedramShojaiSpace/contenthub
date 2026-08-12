import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } = vi.hoisted(() => ({
  getShopifyAdminAccessToken: vi.fn(),
  getShopifyAdminStoreDomain: vi.fn(),
}));

vi.mock("./shopifyAdminAuth", () => ({
  getShopifyAdminAccessToken,
  getShopifyAdminStoreDomain,
}));

import { FUNNELS, fetchShopifyForFunnel } from "./funnelReconciliationRouter";

const tantraFunnel = FUNNELS.find((funnel) => funnel.id === "tantra_quiz")!;

describe("Tantra Shopify reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getShopifyAdminStoreDomain.mockReturnValue("theurbanmonkstore.myshopify.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an explicit unavailable-data note instead of presenting a false zero when order authorization fails", async () => {
    getShopifyAdminAccessToken.mockRejectedValue(new Error("Shopify Admin order-read credentials are not configured"));

    const result = await fetchShopifyForFunnel(tantraFunnel, "2026-07-30", "2026-08-12");

    expect(result.totalRevenueCents).toBe(0);
    expect(result.totalOrders).toBe(0);
    expect(result.note).toContain("order_access_unavailable");
    expect(result.note).toContain("credentials are not configured");
  });

  it("uses mapped Tantra line-item value rather than the full Shopify order total", async () => {
    getShopifyAdminAccessToken.mockResolvedValue("short-lived-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              orders: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [{
                  node: {
                    id: "gid://shopify/Order/6496304529562",
                    createdAt: "2026-07-31T18:03:00-06:00",
                    financialStatus: "PAID",
                    lineItems: {
                      edges: [{
                        node: {
                          product: { id: "gid://shopify/Product/9068203376794" },
                          title: "Tantra Him",
                          quantity: 1,
                          originalUnitPriceSet: { shopMoney: { amount: "185.00" } },
                        },
                      }],
                    },
                  },
                }],
              },
            },
          }),
          { status: 200 }
        )
      )
    );

    const result = await fetchShopifyForFunnel(tantraFunnel, "2026-07-30", "2026-08-12");

    expect(result.note).toBeUndefined();
    expect(result.totalOrders).toBe(1);
    expect(result.totalRevenueCents).toBe(18_500);
    expect(result.tiers).toEqual([
      expect.objectContaining({ productId: "9068203376794", count: 1, revenueCents: 18_500 }),
    ]);
  });
});
