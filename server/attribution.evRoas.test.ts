/**
 * Tests for attribution.getEvRoas (Rec 7 — EV-aware ROAS)
 *
 * These tests verify the Expected Value calculation logic without hitting
 * a real database. The DB is mocked so the procedure receives controlled
 * row data and we assert on the EV math.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockRows: Array<{ campaign: string | null; sales: number; revenueRaw: number }> = [];

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          groupBy: () => ({
            orderBy: () => ({
              limit: undefined,
              // Drizzle-style: the query is awaitable directly
              then: (resolve: (v: typeof mockRows) => void) => resolve(mockRows),
              [Symbol.iterator]: undefined,
            }),
          }),
        }),
      }),
    }),
  })),
}));

// ── Auth context helper ───────────────────────────────────────────────────────

function createAuthContext(): Context {
  return {
    user: { id: 1, openId: "test-open-id", name: "Test Owner", role: "admin" },
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Context;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("attribution.getEvRoas", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("returns zero totals when there are no attributed sales", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({
      days: 30,
      academyUpgradeRate: 0.12,
      academyLtv: 239900,
    });

    expect(result.totalSales).toBe(0);
    expect(result.totalRevenueRaw).toBe(0);
    expect(result.totalEvRevenue).toBe(0);
    expect(result.evUpliftTotal).toBe(0);
    expect(result.byCampaign).toHaveLength(0);
  });

  it("correctly computes EV uplift for a single campaign", async () => {
    // 10 orders at $399 each = $3,990 raw
    mockRows.push({ campaign: "fb-orobiome-v1", sales: 10, revenueRaw: 399000 });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({
      days: 30,
      academyUpgradeRate: 0.12,
      academyLtv: 239900,
    });

    // EV uplift = 10 buyers × 12% upgrade rate × $2,399 LTV = $2,878.80 → 287880 cents
    const expectedUplift = Math.round(10 * 0.12 * 239900); // 287880
    const expectedEvRevenue = 399000 + expectedUplift;

    expect(result.totalSales).toBe(10);
    expect(result.totalRevenueRaw).toBe(399000);
    expect(result.evUpliftTotal).toBe(expectedUplift);
    expect(result.totalEvRevenue).toBe(expectedEvRevenue);
    expect(result.byCampaign[0].campaign).toBe("fb-orobiome-v1");
    expect(result.byCampaign[0].evUpliftCents).toBe(expectedUplift);
  });

  it("sums correctly across multiple campaigns", async () => {
    mockRows.push({ campaign: "fb-orobiome-v1", sales: 5, revenueRaw: 199500 });
    mockRows.push({ campaign: "fb-kbmo-v2", sales: 3, revenueRaw: 119700 });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({
      days: 30,
      academyUpgradeRate: 0.10,
      academyLtv: 239900,
    });

    const uplift1 = Math.round(5 * 0.10 * 239900); // 119950
    const uplift2 = Math.round(3 * 0.10 * 239900); // 71970

    expect(result.totalSales).toBe(8);
    expect(result.totalRevenueRaw).toBe(199500 + 119700);
    expect(result.evUpliftTotal).toBe(uplift1 + uplift2);
    expect(result.byCampaign).toHaveLength(2);
  });

  it("respects a custom upgrade rate of 0% (no EV uplift)", async () => {
    mockRows.push({ campaign: "test-campaign", sales: 20, revenueRaw: 800000 });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({
      days: 30,
      academyUpgradeRate: 0,
      academyLtv: 239900,
    });

    expect(result.evUpliftTotal).toBe(0);
    expect(result.totalEvRevenue).toBe(800000);
  });

  it("respects a custom upgrade rate of 100%", async () => {
    mockRows.push({ campaign: "test-campaign", sales: 2, revenueRaw: 100000 });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({
      days: 30,
      academyUpgradeRate: 1.0,
      academyLtv: 239900,
    });

    const expectedUplift = Math.round(2 * 1.0 * 239900); // 479800
    expect(result.evUpliftTotal).toBe(expectedUplift);
    expect(result.totalEvRevenue).toBe(100000 + expectedUplift);
  });

  it("returns the explanatory note string", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.attribution.getEvRoas({});

    expect(result.note).toContain("EV =");
    expect(result.note).toContain("upgradeRate");
  });
});
