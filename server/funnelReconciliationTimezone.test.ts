import { describe, expect, it } from "vitest";
import {
  getChicagoDayBounds,
  toChicagoDateKey,
} from "./funnelReconciliationRouter";

describe("Interconnected reconciliation Central-time reporting", () => {
  it("assigns dates at the Central-time boundary rather than the UTC calendar boundary", () => {
    expect(toChicagoDateKey(Date.parse("2026-08-14T04:30:00.000Z"))).toBe("2026-08-13");
    expect(toChicagoDateKey(Date.parse("2026-08-14T05:30:00.000Z"))).toBe("2026-08-14");
  });

  it("builds an inclusive Central-day window across the daylight-saving offset", () => {
    const { startMs, endExclusiveMs } = getChicagoDayBounds("2026-08-13");

    expect(new Date(startMs).toISOString()).toBe("2026-08-13T05:00:00.000Z");
    expect(new Date(endExclusiveMs).toISOString()).toBe("2026-08-14T05:00:00.000Z");
  });
});
