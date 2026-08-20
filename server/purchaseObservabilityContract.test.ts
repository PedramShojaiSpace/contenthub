import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Purchase observability contract", () => {
  it("retains Meta Purchase action values in the existing one-call reconciliation refresh", () => {
    const source = readFileSync(new URL("./funnelReconciliationRouter.ts", import.meta.url), "utf8");
    expect(source).toContain('"action_values"');
    expect(source).toContain("canonicalMetaPurchaseCount");
    expect(source).toContain("canonicalMetaPurchaseValue");
    expect(source).toContain("metaApiCalls: 1");
  });

  it("returns side-by-side CAPI evidence without changing campaign optimization", () => {
    const source = readFileSync(new URL("./funnelReconciliationRouter.ts", import.meta.url), "utf8");
    expect(source).toContain("getCapiPurchaseEvidence");
    expect(source).toContain("capiPurchases");
    expect(source).not.toContain("campaignStatus");
  });
});
