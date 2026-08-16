/**
 * Live smoke test for the Shopify Storefront integration.
 *
 * Goal: prove the store actually returns at least one usable product with
 * the three things a storefront needs to render — a title, an image, and a
 * non-zero price. If this passes, the homepage and PDP will work; if it
 * fails, there's an integration / catalog issue, not a UI bug.
 *
 * Behavior:
 *   - Calls the real Storefront API via `listProducts()` (no mocking).
 *   - Auto-skips when `SHOPIFY_STORE_DOMAIN` and the storefront token aren't
 *     configured, so CI environments without credentials stay green.
 *   - Logs the first 3 normalized products so the agent can see the actual
 *     output (titles, prices, image URLs) without reaching for `curl`.
 *
 * For a more verbose, standalone version see `scripts/shopify-probe.mjs`.
 */

import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { isShopifyConfigured, listProducts } from "./_core/shopify";
import { appRouter } from "./routers";

const configured = isShopifyConfigured();

describe.skipIf(!configured)("shopify smoke (live)", () => {
  it(
    "serves real products through the public commerce tRPC route without creating a cart",
    { timeout: 30_000 },
    async () => {
      const caller = appRouter.createCaller({} as TrpcContext);
      const products = await caller.commerce.products.list({ first: 3 });

      expect(products.length).toBeGreaterThanOrEqual(1);
      expect(products.every(product => product.handle.length > 0)).toBe(true);
    }
  );

  it(
    "creates and clears a disposable public cart without opening checkout",
    { timeout: 30_000 },
    async () => {
      const caller = appRouter.createCaller({} as TrpcContext);
      const products = await caller.commerce.products.list({ first: 10 });
      const purchasable = products
        .flatMap(product => product.variants)
        .find(variant => variant.availableForSale);

      expect(purchasable, "No purchasable Shopify variant was available for the cart smoke test").toBeTruthy();

      const cart = await caller.commerce.cart.create({
        lines: [{ variantId: purchasable!.id, quantity: 1 }],
      });

      expect(cart.id).toBeTruthy();
      expect(cart.itemCount).toBe(1);
      expect(cart.checkoutUrl).toMatch(/^https:\/\//);
      expect(cart.items).toHaveLength(1);

      const cleared = await caller.commerce.cart.removeLines({
        cartId: cart.id,
        lineIds: cart.items.map(item => item.lineId),
      });

      expect(cleared.itemCount).toBe(0);
      expect(cleared.items).toHaveLength(0);
    }
  );

  it(
    "returns at least one product with title, image, and non-zero price",
    { timeout: 30_000 },
    async () => {
    const products = await listProducts({ first: 10 });

    // Print a compact view so the agent can see the actual normalized output
    // (titles, prices, image URLs) directly in test logs.
    const preview = products.slice(0, 3).map(p => ({
      handle: p.handle,
      title: p.title,
      price: `${p.priceRange.min.amount} ${p.priceRange.min.currencyCode}`,
      firstImage: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
    }));
    // eslint-disable-next-line no-console
    console.log("[shopify smoke] products:", JSON.stringify(preview, null, 2));

    expect(products.length).toBeGreaterThanOrEqual(1);

    const usable = products.find(p => {
      const hasTitle = typeof p.title === "string" && p.title.trim().length > 0;
      const hasImage = (p.images[0]?.url ?? "").length > 0;
      const priceNum = Number.parseFloat(p.priceRange.min.amount);
      const hasPrice = Number.isFinite(priceNum) && priceNum > 0;
      return hasTitle && hasImage && hasPrice;
    });

      expect(
        usable,
        "No product had all three of: title, first image URL, and price > 0"
      ).toBeTruthy();
    }
  );
});

// Visible reminder when the suite is skipped — keeps it from looking like a
// silent pass on misconfigured sandboxes.
describe.skipIf(configured)("shopify smoke (skipped)", () => {
  it("is skipped because SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_API_ACCESS_TOKEN are not set", () => {
    expect(true).toBe(true);
  });
});
