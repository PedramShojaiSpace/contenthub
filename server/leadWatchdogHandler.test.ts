import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildHourlyLeadSummary, summarizeLeadPaths } from "./leadWatchdogHandler";

describe("buildHourlyLeadSummary", () => {
  it("creates one aggregate hourly message without individual lead identity", () => {
    const summary = buildHourlyLeadSummary({
      leadsInWindow: 27,
      todayTotal: 84,
      dbTotal: 4090,
      hourlyByPath: { kajabi: 20, koKlaviyo: 7, unassigned: 0 },
      todayByPath: { kajabi: 60, koKlaviyo: 20, unassigned: 4 },
      totalByPath: { kajabi: 3900, koKlaviyo: 150, unassigned: 40 },
      koCheckoutStartsInWindow: 3,
      koCheckoutStartsToday: 5,
      koPaidOrdersInWindow: 0,
      koPaidOrdersToday: 0,
      kajabiCount: 4088,
      kajabiGap: 2,
      kajabiCheckError: null,
      checkedAtCT: "8/22/2026, 1:00:00 PM",
    });

    expect(summary.title).toBe("📊 Hourly Opt-In Summary — 27 new opt-ins");
    expect(summary.content).toContain("last hour: 27");
    expect(summary.content).toContain("Today's recorded total: 84");
    expect(summary.content).toContain("Last hour by path — KO/Klaviyo: 7; Kajabi: 20; legacy/unassigned: 0");
    expect(summary.content).toContain("Today by path — KO/Klaviyo: 20; Kajabi: 60; legacy/unassigned: 4");
    expect(summary.content).toContain("checkout starts: 3 in the last hour / 5 today");
    expect(summary.content).toContain("lead → paid today: 0.00%");
    expect(summary.content).not.toMatch(/@|phone|email/i);
    expect(summary.isQuiet).toBe(false);
  });

  it("reports a quiet hour within the same single-summary format", () => {
    const summary = buildHourlyLeadSummary({
      leadsInWindow: 0,
      todayTotal: 0,
      dbTotal: 4090,
      hourlyByPath: { kajabi: 0, koKlaviyo: 0, unassigned: 0 },
      todayByPath: { kajabi: 0, koKlaviyo: 0, unassigned: 0 },
      totalByPath: { kajabi: 4090, koKlaviyo: 0, unassigned: 0 },
      koCheckoutStartsInWindow: 0,
      koCheckoutStartsToday: 0,
      koPaidOrdersInWindow: 0,
      koPaidOrdersToday: 0,
      kajabiCount: 4050,
      kajabiGap: 40,
      kajabiCheckError: null,
      checkedAtCT: "8/22/2026, 2:00:00 AM",
    });

    expect(summary.title).toBe("📊 Hourly Opt-In Summary — 0 new opt-ins");
    expect(summary.content).toContain("No recorded opt-ins in this hour");
    expect(summary.content).toContain("40 recorded-lead gap — review");
    expect(summary.isQuiet).toBe(true);
    expect(summary.hasTagGap).toBe(true);
  });

  it("elevates the hourly summary when a paid KO checkout converts", () => {
    const summary = buildHourlyLeadSummary({
      leadsInWindow: 4,
      todayTotal: 24,
      dbTotal: 4090,
      hourlyByPath: { kajabi: 0, koKlaviyo: 4, unassigned: 0 },
      todayByPath: { kajabi: 0, koKlaviyo: 24, unassigned: 0 },
      totalByPath: { kajabi: 3900, koKlaviyo: 150, unassigned: 40 },
      koCheckoutStartsInWindow: 2,
      koCheckoutStartsToday: 6,
      koPaidOrdersInWindow: 1,
      koPaidOrdersToday: 1,
      kajabiCount: 4088,
      kajabiGap: 2,
      kajabiCheckError: null,
      checkedAtCT: "9/20/2026, 1:00:00 PM",
    });

    expect(summary.title).toBe("✓ KO/Klaviyo $67 sale alert — 1 new paid order");
    expect(summary.content).toContain("paid Shopify orders from this checkout path: 1 in the last hour / 1 today");
    expect(summary.content).toContain("lead → paid today: 4.17%");
    expect(summary.hasNewKoPaidOrder).toBe(true);
  });

  it("normalizes grouped lead rows into explicit funnel-path counts", () => {
    expect(summarizeLeadPaths([
      { path: "ko_klaviyo", cnt: 7 },
      { path: "kajabi", cnt: "11" },
      { path: null, cnt: 3 },
    ])).toEqual({ kajabi: 11, koKlaviyo: 7, unassigned: 3 });
  });

  it("keeps the Kajabi opt-in endpoint free of individual owner-lead alerts", () => {
    const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

    expect(serverSource).not.toContain("New Lead (Kajabi page)");
    expect(serverSource).toContain("Owner notifications are intentionally batched by the hourly lead watchdog");
  });
});
