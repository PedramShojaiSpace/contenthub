import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Interconnected KO/Klaviyo scheduled collector", () => {
  it("accepts only its registered Heartbeat task and always uses a completed-day window", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const start = source.indexOf('app.post("/api/scheduled/interconnected-email-performance"');
    const end = source.indexOf('// POST /api/scheduled/weekly-deep-dive', start);
    const handler = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(handler).toContain("user.isCron || !user.taskUid");
    expect(handler).toContain("settings.collectionScheduleTaskUid !== user.taskUid");
    expect(handler).toContain("completedTrailingWindow()");
    expect(handler).toContain("collectKlaviyoSnapshot(windowStart, windowEnd)");
    expect(handler).not.toContain("meta");
  });

  it("notifies the owner only when the first successful collection has been persisted", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const start = source.indexOf('app.post("/api/scheduled/interconnected-email-performance"');
    const end = source.indexOf('// POST /api/scheduled/weekly-deep-dive', start);
    const handler = source.slice(start, end);

    expect(handler).toContain("const firstCollection = !settings.lastKlaviyoCollectedAt");
    expect(handler).toContain("if (firstCollection)");
    expect(handler.indexOf("lastKlaviyoCollectedAt: result.collectedAt")).toBeLessThan(
      handler.indexOf("if (firstCollection)")
    );
    expect(handler).toContain("KO/Klaviyo Email Revenue Collector Verified");
  });
});
