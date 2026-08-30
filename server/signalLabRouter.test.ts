import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateAggregateResult } from "./signalLabRouter";

describe("Signal Lab aggregate-result safeguards", () => {
  const valid = {
    impressions: 1_000,
    outboundClicks: 100,
    landingPageViews: 80,
    leads: 20,
    qualifiedLeads: 10,
    checkouts: 6,
    purchases: 3,
    spendCents: 10_000,
    revenueCents: 20_100,
  };

  it("accepts a coherent aggregate-only scorecard row", () => {
    expect(() => validateAggregateResult(valid)).not.toThrow();
  });

  it("rejects incoherent downstream results before persistence", () => {
    expect(() => validateAggregateResult({ ...valid, qualifiedLeads: 21 })).toThrow("Qualified leads");
    expect(() => validateAggregateResult({ ...valid, purchases: 7 })).toThrow("Purchases");
    expect(() => validateAggregateResult({ ...valid, landingPageViews: 101 })).toThrow("Landing page views");
  });

  it("uses admin protection and contains no Meta write client or ad-account API endpoint", async () => {
    const source = await readFile(path.resolve(process.cwd(), "server/signalLabRouter.ts"), "utf8");
    expect(source).toContain("adminProcedure");
    expect(source).not.toContain("metaAdsClient");
    expect(source).not.toContain("graph.facebook.com");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("launchCampaign");
  });
});
