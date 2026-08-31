import { describe, expect, it } from "vitest";
import { percentChange, summarizeDateWindow } from "../scripts/lib/agoraRoasAnalysis.mjs";

const sample = [
  { date: "2026-08-20", spend: 100, impressions: 1_000, inlineLinkClicks: 50, leads: 20, checkouts: 4, purchases: 2, purchaseValue: 200 },
  { date: "2026-08-21", spend: 50, impressions: 500, inlineLinkClicks: 15, leads: 10, checkouts: 1, purchases: 1, purchaseValue: 25 },
];

describe("Agora ROAS analysis", () => {
  it("aggregates supplied Meta insight rows without requiring campaign write access", () => {
    expect(summarizeDateWindow(sample, "2026-08-20", "2026-08-21")).toMatchObject({
      spend: 150,
      leads: 30,
      checkouts: 5,
      purchases: 3,
      purchaseValue: 225,
      roas: 1.5,
      cpl: 5,
      checkoutRate: 5 / 30,
      purchaseRate: 0.1,
    });
  });

  it("reports comparable changes and preserves a null result where there is no valid baseline", () => {
    expect(percentChange(1.5, 1)).toBe(0.5);
    expect(percentChange(1, 0)).toBeNull();
  });
});
