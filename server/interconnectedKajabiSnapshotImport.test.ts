import { describe, expect, it } from "vitest";
import { buildKajabiSnapshot } from "./interconnectedEmailRevenueRouter";

describe("Kajabi native snapshot import", () => {
  const base = {
    messageId: "2151341113",
    messageName: "Interconnected Day 0",
    windowStart: Date.UTC(2026, 7, 1),
    windowEnd: Date.UTC(2026, 7, 15),
    recipients: 20,
    delivered: 19,
    opens: 10,
    clicks: 4,
    platformConversions: 1,
    platformRevenueCents: 6700,
  };

  it("imports native Kajabi values into only the Kajabi path", () => {
    const snapshot = buildKajabiSnapshot(base, Date.UTC(2026, 7, 15, 12));
    expect(snapshot.funnelPath).toBe("kajabi");
    expect(snapshot.platform).toBe("kajabi");
    expect(snapshot.messageKey).toBeNull();
    expect(snapshot.rawMetrics).toContain("platform-attributed");
  });

  it("rejects impossible delivered counts", () => {
    expect(() => buildKajabiSnapshot({ ...base, delivered: 21 })).toThrow("cannot exceed recipients");
  });
});
