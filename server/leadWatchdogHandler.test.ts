import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildHourlyLeadSummary } from "./leadWatchdogHandler";

describe("buildHourlyLeadSummary", () => {
  it("creates one aggregate hourly message without individual lead identity", () => {
    const summary = buildHourlyLeadSummary({
      leadsInWindow: 27,
      todayTotal: 84,
      dbTotal: 4090,
      kajabiCount: 4088,
      kajabiGap: 2,
      kajabiCheckError: null,
      checkedAtCT: "8/22/2026, 1:00:00 PM",
    });

    expect(summary.title).toBe("📊 Hourly Opt-In Summary — 27 new opt-ins");
    expect(summary.content).toContain("last hour: 27");
    expect(summary.content).toContain("Today's recorded total: 84");
    expect(summary.content).not.toMatch(/@|phone|email/i);
    expect(summary.isQuiet).toBe(false);
  });

  it("reports a quiet hour within the same single-summary format", () => {
    const summary = buildHourlyLeadSummary({
      leadsInWindow: 0,
      todayTotal: 0,
      dbTotal: 4090,
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

  it("keeps the Kajabi opt-in endpoint free of individual owner-lead alerts", () => {
    const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

    expect(serverSource).not.toContain("New Lead (Kajabi page)");
    expect(serverSource).toContain("Owner notifications are intentionally batched by the hourly lead watchdog");
  });
});
