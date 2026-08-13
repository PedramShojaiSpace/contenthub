import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("System Health critical integration monitoring", () => {
  it("uses the protected critical-health router for Shopify, Kajabi, Klaviyo, WordPress, Meta, and webhook status", () => {
    const routerSource = readFileSync(new URL("./integrationHealthRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/SystemHealth.tsx", import.meta.url), "utf8");

    expect(routerSource).toContain("critical: protectedProcedure.query");
    expect(routerSource).toContain("checkWordPress()");
    expect(routerSource).toContain("checkShopify()");
    expect(routerSource).toContain("checkMeta()");
    expect(routerSource).toContain("checkKajabi()");
    expect(routerSource).toContain("checkKlaviyo()");
    expect(routerSource).toContain("checkShopifyWebhookFreshness()");
    expect(pageSource).toContain("trpc.integrationHealth.critical.useQuery");
    expect(pageSource).toContain('healthStatus("kajabi")');
    expect(pageSource).toContain('healthStatus("klaviyo")');
    expect(pageSource).toContain('healthStatus("shopifyWebhook")');
  });
});
