import { describe, expect, it } from "vitest";
import { priceTestActivationBlockers, summarizeAgoraPriceTestTransactions } from "./agoraPriceTestTracking";
import type { KajabiTransactionRow } from "./kajabiSalesRouter";

const arms = [
  { armId: "p49" as const, label: "$49 treatment — P1", priceCents: 4900, isControl: false, offerId: "p49-offer", checkoutUrl: "https://example.com/49" },
  { armId: "p67" as const, label: "$67 current control", priceCents: 6700, isControl: true, offerId: "p67-offer", checkoutUrl: "https://example.com/67" },
  { armId: "p99" as const, label: "$99 treatment — P2", priceCents: 9900, isControl: false, offerId: "p99-offer", checkoutUrl: "https://example.com/99" },
];

function row(offerId: string, amount: number, overrides: Partial<KajabiTransactionRow["attributes"]> = {}): KajabiTransactionRow {
  return {
    id: `${offerId}-${amount}-${Math.random()}`,
    attributes: { amount_in_cents: amount, created_at: "2026-09-04T18:00:00.000Z", state: "succeeded", ...overrides },
    relationships: { offer: { data: { id: offerId } } },
  };
}

describe("summarizeAgoraPriceTestTransactions", () => {
  it("attributes only exact Offer ID plus expected amount to a base-price arm", () => {
    const report = summarizeAgoraPriceTestTransactions([
      row("p49-offer", 4900),
      row("p67-offer", 6700),
      row("p67-offer", 4900),
      row("unrelated-49", 4900),
    ], "2026-09-04", "2026-09-04", arms);
    expect(report.arms.find((arm) => arm.armId === "p49")?.clearedPurchases).toBe(1);
    expect(report.arms.find((arm) => arm.armId === "p49")?.clearedRevenueCents).toBe(4900);
    expect(report.arms.find((arm) => arm.armId === "p67")?.clearedPurchases).toBe(1);
  });

  it("excludes refunded or failed exact-offer rows and surfaces the excluded count", () => {
    const report = summarizeAgoraPriceTestTransactions([
      row("p49-offer", 4900, { state: "refunded" }),
      row("p49-offer", 4900, { action: "refund" }),
      row("p49-offer", 4900, { state: "failed" }),
    ], "2026-09-04", "2026-09-04", arms);
    const p49 = report.arms.find((arm) => arm.armId === "p49");
    expect(p49?.clearedPurchases).toBe(0);
    expect(p49?.excludedRefundRows).toBe(3);
  });

  it("reports the shared $199 OCUS separately without assigning it to a price arm", () => {
    const report = summarizeAgoraPriceTestTransactions([
      row("2151333044", 19900),
    ], "2026-09-04", "2026-09-04", arms);
    expect(report.sharedOcus.clearedPurchases).toBe(1);
    expect(report.sharedOcus.attributionStatus).toBe("unassigned_until_live_cohort_link");
    expect(report.arms.every((arm) => arm.clearedPurchases === 0)).toBe(true);
  });
});

describe("priceTestActivationBlockers", () => {
  it("allows a fully mapped internal tracker to be internally complete while remaining draft-only by design", () => {
    const blockers = priceTestActivationBlockers({
      status: "draft",
      trafficAllocationActive: false,
      ocusParityP49Verified: true,
      ocusParityP67Verified: true,
      ocusParityP99Verified: true,
      arms,
    });
    expect(blockers).toEqual([]);
  });

  it("flags incomplete Offer mappings and any active allocation as an explicit blocker", () => {
    const blockers = priceTestActivationBlockers({
      status: "draft",
      trafficAllocationActive: true,
      ocusParityP49Verified: false,
      ocusParityP67Verified: true,
      ocusParityP99Verified: false,
      arms: [{ ...arms[0], offerId: null, checkoutUrl: null }, ...arms.slice(1)],
    });
    expect(blockers).toEqual(expect.arrayContaining([
      "$49 treatment — P1 is missing an exact Kajabi Offer ID.",
      "$49 treatment — P1 is missing its recorded checkout URL.",
      "$199 OCUS parity is not verified for the $49 arm.",
      "$199 OCUS parity is not verified for the $99 arm.",
      "Traffic allocation is active; this tracker does not activate or control it.",
    ]));
  });
});
