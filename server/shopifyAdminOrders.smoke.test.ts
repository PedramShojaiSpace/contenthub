import { describe, expect, it } from "vitest";
import { FUNNELS, fetchShopifyForFunnel } from "./funnelReconciliationRouter";

const configuredStorefrontDomain = process.env.SHOPIFY_STORE_DOMAIN
  ?.replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");
const shop = configuredStorefrontDomain?.endsWith(".myshopify.com")
  ? configuredStorefrontDomain
  : "theurbanmonkstore.myshopify.com";
const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const configured = Boolean(shop && clientId && clientSecret);

describe.skipIf(!configured)("shopify admin orders credentials (live)", () => {
  it(
    "exchanges the installed app credentials for a token with read_orders",
    { timeout: 30_000 },
    async () => {
      const response = await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId!,
            client_secret: clientSecret!,
          }),
        }
      );

      const responseText = await response.text();
      const body = JSON.parse(responseText) as {
        access_token?: string;
        scope?: string;
      };

      expect(
        response.ok,
        `Shopify token request failed: ${response.status} ${responseText.slice(0, 160)}`
      ).toBe(true);
      expect(body.access_token).toEqual(expect.any(String));
      expect(body.access_token?.length).toBeGreaterThan(20);
      expect(body.scope?.split(",")).toContain("read_orders");

      const orderResponse = await fetch(
        `https://${shop}/admin/api/2026-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": body.access_token!,
          },
          body: JSON.stringify({
            query: "query { orders(first: 1, query: \"financial_status:paid\") { nodes { id } } }",
          }),
        }
      );
      const orderBody = (await orderResponse.json()) as {
        data?: { orders?: { nodes?: Array<{ id: string }> } };
        errors?: Array<{ message: string }>;
      };

      expect(orderResponse.ok, `Shopify order query failed: ${orderResponse.status}`).toBe(true);
      expect(orderBody.errors ?? []).toHaveLength(0);
      expect(orderBody.data?.orders?.nodes).toBeInstanceOf(Array);
    }
  );

  it(
    "returns the verified Tantra Him line-item sale through the reconciliation reader",
    { timeout: 30_000 },
    async () => {
      const tantraFunnel = FUNNELS.find((funnel) => funnel.id === "tantra_quiz");
      expect(tantraFunnel).toBeDefined();

      const result = await fetchShopifyForFunnel(
        tantraFunnel!,
        "2026-07-30",
        "2026-08-12"
      );
      const tantraHim = result.tiers.find((tier) => tier.productId === "9068203376794");

      expect(result.note).toBeUndefined();
      expect(tantraHim).toMatchObject({ count: 1, revenueCents: 18_500 });
    }
  );
});

describe.skipIf(configured)("shopify admin orders credentials (skipped)", () => {
  it("is skipped because the client-credentials configuration is incomplete", () => {
    expect(true).toBe(true);
  });
});
