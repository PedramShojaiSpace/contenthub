/**
 * Shopify tRPC Router
 * Exposes checkout URL generation, product listing, and webhook config.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { FUNNEL_PRODUCTS, buildCheckoutUrl, createStorefrontCheckout } from "./shopify";

export const shopifyRouter = router({
  listFunnelProducts: protectedProcedure.query(() => {
    return Object.entries(FUNNEL_PRODUCTS).map(([key, product]) => ({
      key,
      name: product.name,
      variantId: product.variantId,
      priceCents: product.priceCents,
      priceFormatted: `$${(product.priceCents / 100).toFixed(2)}`,
      checkoutUrl: product.checkoutUrl,
      funnelSource: product.funnelSource,
      klaviyoTag: product.klaviyoTag,
      isReady: Boolean(product.variantId && product.checkoutUrl),
    }));
  }),

  getCheckoutUrl: publicProcedure
    .input(z.object({
      productKey: z.string(),
      clickToken: z.string().optional(),
      email: z.string().email().optional(),
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
      discountCode: z.string().optional(),
      qty: z.number().min(1).max(10).default(1),
    }))
    .mutation(async ({ input }) => {
      const product = FUNNEL_PRODUCTS[input.productKey];
      if (!product) return { ok: false, error: `Unknown product key: ${input.productKey}`, checkoutUrl: null };
      if (!product.variantId) return { ok: false, error: `Product ${input.productKey} has no variant ID yet`, checkoutUrl: null };
      const checkoutUrl = buildCheckoutUrl(product.variantId, input.qty, {
        clickToken: input.clickToken,
        email: input.email,
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        discountCode: input.discountCode,
      });
      return { ok: true, checkoutUrl, productName: product.name, priceCents: product.priceCents };
    }),

  createCheckout: publicProcedure
    .input(z.object({
      productKey: z.string(),
      email: z.string().email().optional(),
      clickToken: z.string().optional(),
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
      discountCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const product = FUNNEL_PRODUCTS[input.productKey];
      if (!product) return { ok: false, error: `Unknown product key: ${input.productKey}`, checkoutUrl: null };
      if (!product.variantId) return { ok: false, error: `Product ${input.productKey} has no variant ID yet`, checkoutUrl: null };

      const customAttributes: Array<{ key: string; value: string }> = [];
      if (input.clickToken) customAttributes.push({ key: "_um_click_token", value: input.clickToken });
      if (input.utmSource) customAttributes.push({ key: "utm_source", value: input.utmSource });
      if (input.utmCampaign) customAttributes.push({ key: "utm_campaign", value: input.utmCampaign });

      const result = await createStorefrontCheckout({
        variantId: product.variantId,
        email: input.email,
        customAttributes,
        discountCode: input.discountCode,
      });

      if (!result) {
        const fallbackUrl = buildCheckoutUrl(product.variantId, 1, {
          clickToken: input.clickToken,
          email: input.email,
          utmSource: input.utmSource,
          utmCampaign: input.utmCampaign,
          discountCode: input.discountCode,
        });
        return { ok: true, checkoutUrl: fallbackUrl, method: "cart_permalink" };
      }
      return { ok: true, checkoutUrl: result.checkoutUrl, checkoutId: result.checkoutId, method: "storefront_api" };
    }),

  getWebhookConfig: protectedProcedure.query(() => ({
    webhookUrl: "https://content.theurbanmonk.com/api/shopify/order-paid",
    topic: "orders/paid",
    format: "JSON",
    status: "CONFIGURED",
    instructions: [
      "Shopify Admin → Settings → Notifications → Webhooks",
      "Create webhook: Event = Order payment, Format = JSON",
      "URL: https://content.theurbanmonk.com/api/shopify/order-paid",
      "API version: 2024-10",
      "Copy signing secret → add as SHOPIFY_WEBHOOK_SECRET in project secrets",
    ],
  })),

  testConnection: protectedProcedure.query(async () => {
    const token = process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN;
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    if (!token || !domain) return { ok: false, error: "Missing SHOPIFY env vars" };
    try {
      const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
        body: JSON.stringify({ query: "{ shop { name } }" }),
      });
      const json = await res.json() as any;
      const shopName = json?.data?.shop?.name;
      if (shopName) return { ok: true, shopName, domain };
      return { ok: false, error: JSON.stringify(json) };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }),
});
