import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Shopify paid-order webhook route", () => {
  it("registers raw-body handling before the global JSON parser", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const webhookRoute = source.indexOf('app.post("/api/shopify/order-paid"');
    const jsonParser = source.indexOf('app.use(express.json({ limit: "50mb" }))');

    expect(webhookRoute).toBeGreaterThanOrEqual(0);
    expect(jsonParser).toBeGreaterThanOrEqual(0);
    expect(webhookRoute).toBeLessThan(jsonParser);
    expect(source.slice(webhookRoute, jsonParser)).toContain('express.raw({ type: "application/json" })');
  });
});
