import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Shopify order webhook routes", () => {
  it("registers raw-body handling before the global JSON parser", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const paidWebhookRoute = source.indexOf('app.post("/api/shopify/order-paid"');
    const updatedWebhookRoute = source.indexOf('app.post("/api/shopify/order-updated"');
    const jsonParser = source.indexOf("app.use(express.json({");

    expect(paidWebhookRoute).toBeGreaterThanOrEqual(0);
    expect(updatedWebhookRoute).toBeGreaterThanOrEqual(0);
    expect(jsonParser).toBeGreaterThanOrEqual(0);
    expect(paidWebhookRoute).toBeLessThan(jsonParser);
    expect(updatedWebhookRoute).toBeLessThan(jsonParser);
    expect(source.slice(paidWebhookRoute, jsonParser)).toContain('express.raw({ type: "application/json" })');
    expect(source.slice(updatedWebhookRoute, jsonParser)).toContain('express.raw({ type: "application/json" })');
  });
});
