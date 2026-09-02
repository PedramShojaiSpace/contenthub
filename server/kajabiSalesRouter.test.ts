import { describe, expect, it } from "vitest";
import {
  HISTORICAL_299_OCUS_BENCHMARK,
  operationalDate,
  summarizeCurrentInterconnectedTransactions,
  type KajabiTransactionRow,
} from "./kajabiSalesRouter";

function transaction(
  id: string,
  offerId: string,
  amount: number,
  createdAt = "2026-08-16T12:00:00-05:00",
  state = "paid",
): KajabiTransactionRow {
  return {
    id,
    attributes: { amount_in_cents: amount, created_at: createdAt, state, action: "purchase" },
    relationships: { offer: { data: { id: offerId } } },
  };
}

describe("summarizeCurrentInterconnectedTransactions", () => {
  it("includes only the active $67 entry offer and current $199 OCUS within the selected date range", () => {
    const summary = summarizeCurrentInterconnectedTransactions([
      transaction("entry-1", "2151314475", 6700),
      transaction("entry-2", "2151314475", 6700),
      transaction("ocus-1", "2151333044", 19900),
      transaction("legacy-299", "2151318548", 29900),
      transaction("unrelated-199", "9999999999", 19900),
      transaction("refunded-entry", "2151314475", 6700, "2026-08-16T14:00:00-05:00", "refunded"),
      transaction("prior-day", "2151314475", 6700, "2026-08-15T23:59:00-05:00"),
    ], "2026-08-16", "2026-08-16");

    expect(summary.tiers).toEqual([
      { tier: "67", label: "Interconnected $67 Bundle OTO", priceCents: 6700, count: 2, revenueCents: 13400 },
      { tier: "199", label: "Gut Permeability + Food Sensitivity Test w/ Coach ($199 OCUS)", priceCents: 19900, count: 1, revenueCents: 19900 },
    ]);
    expect(summary.totalPurchases).toBe(3);
    expect(summary.totalRevenueCents).toBe(33300);
    expect(summary.apiMethod).toBe("transactions_by_site_exact_offer");
  });

  it("rejects amount mismatches even when the transaction references an active offer", () => {
    const summary = summarizeCurrentInterconnectedTransactions([
      transaction("incorrect-price", "2151333044", 29900),
    ], "2026-08-16", "2026-08-16");

    expect(summary.tiers).toEqual([]);
    expect(summary.totalPurchases).toBe(0);
    expect(summary.totalRevenueCents).toBe(0);
  });

  it("keeps the verified historical $299 reference outside the current-offer summary", () => {
    const summary = summarizeCurrentInterconnectedTransactions([
      transaction("legacy-299", "2151318548", 29900),
    ], "2026-08-16", "2026-08-16");

    expect(summary.totalPurchases).toBe(0);
    expect(HISTORICAL_299_OCUS_BENCHMARK).toEqual({
      entryPurchases: 16,
      upsellPurchases: 4,
      upsellRevenueCents: 119600,
      takeRatePct: 25,
      auditReference: "Direct Kajabi historical offer audit — 2026-08-16",
    });
  });

  it("uses Central-time calendar dates so UTC midnight does not pull yesterday into today", () => {
    const summary = summarizeCurrentInterconnectedTransactions([
      transaction("late-central-sept-1", "2151314475", 6700, "2026-09-02T00:30:00.000Z"),
      transaction("late-central-sept-2", "2151314475", 6700, "2026-09-03T04:30:00.000Z"),
    ], "2026-09-02", "2026-09-02");

    expect(operationalDate("2026-09-02T00:30:00.000Z")).toBe("2026-09-01");
    expect(operationalDate("2026-09-03T04:30:00.000Z")).toBe("2026-09-02");
    expect(summary.totalPurchases).toBe(1);
    expect(summary.totalRevenueCents).toBe(6700);
  });
});
