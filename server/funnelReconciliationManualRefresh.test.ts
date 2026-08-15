import { describe, expect, it } from "vitest";
import { oneCallManualMetaRefresh, reconciliationMetaSnapshotKey } from "./funnelReconciliationRouter";

describe("manual reconciliation Meta refresh contract", () => {
  it("creates a stable snapshot key per funnel and reporting range", () => {
    expect(reconciliationMetaSnapshotKey("interconnected_agora", "2026-08-01", "2026-08-15"))
      .toBe("interconnected_agora:2026-08-01:2026-08-15");
  });

  it("invokes the supplied Meta collector exactly once for a manual refresh", async () => {
    let calls = 0;
    const result = await oneCallManualMetaRefresh(async () => {
      calls += 1;
      return { spend: 42.5 };
    });
    expect(result).toEqual({ spend: 42.5 });
    expect(calls).toBe(1);
  });
});
