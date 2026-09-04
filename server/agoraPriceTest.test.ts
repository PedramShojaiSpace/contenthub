import { describe, expect, it } from "vitest";
import {
  AGORA_PRICE_ARM_SPECS,
  CURRENT_INTERCONNECTED_OCUS_CONTRACT,
  classifyPriceTestBaseOffer,
  getAgoraPriceTestDraftReadiness,
  resolvePriceTestMeasurementConfig,
} from "./agoraPriceTest";

describe("Agora draft price-test readiness", () => {
  it("is explicitly non-live and blocks traffic until missing offer mappings are resolved", () => {
    const readiness = getAgoraPriceTestDraftReadiness();

    expect(readiness.status).toBe("draft");
    expect(readiness.trafficAllocationActive).toBe(false);
    expect(readiness.externalOffersCreated).toBe(false);
    expect(readiness.priceArms.find((arm) => arm.armId === "p67")?.offerId).toBe("2151314475");
    expect(readiness.priceArms.find((arm) => arm.armId === "p49")?.offerId).toBeNull();
    expect(readiness.priceArms.find((arm) => arm.armId === "p99")?.offerId).toBeNull();
    expect(readiness.ocus.equivalenceVerifiedForAllPriceArms).toBe(false);
    expect(readiness.blockers).toHaveLength(5);
  });

  it("rejects price testing when an arm has no exact Kajabi Offer ID", () => {
    expect(() =>
      resolvePriceTestMeasurementConfig({
        offerIds: { p49: undefined, p67: "2151314475", p99: "future-99" },
        ocusOfferId: CURRENT_INTERCONNECTED_OCUS_CONTRACT.offerId,
        ocusEquivalenceVerified: true,
      }),
    ).toThrow("Exact Kajabi Offer ID is required for $49 treatment.");
  });

  it("rejects duplicated Offer IDs instead of inferring the price arm from amount", () => {
    expect(() =>
      resolvePriceTestMeasurementConfig({
        offerIds: { p49: "future-49", p67: "2151314475", p99: "future-49" },
        ocusOfferId: CURRENT_INTERCONNECTED_OCUS_CONTRACT.offerId,
        ocusEquivalenceVerified: true,
      }),
    ).toThrow("Each price arm requires a different exact Kajabi Offer ID.");
  });

  it("rejects use of the $199 upgrade until equivalent eligibility is confirmed", () => {
    expect(() =>
      resolvePriceTestMeasurementConfig({
        offerIds: { p49: "future-49", p67: "2151314475", p99: "future-99" },
        ocusOfferId: CURRENT_INTERCONNECTED_OCUS_CONTRACT.offerId,
        ocusEquivalenceVerified: false,
      }),
    ).toThrow("$199 OCUS equivalence must be verified for every entry-price arm before activation.");
  });

  it("classifies only exact configured base offer IDs and matching price amounts", () => {
    const config = resolvePriceTestMeasurementConfig({
      offerIds: { p49: "future-49", p67: "2151314475", p99: "future-99" },
      ocusOfferId: CURRENT_INTERCONNECTED_OCUS_CONTRACT.offerId,
      ocusEquivalenceVerified: true,
    });

    expect(classifyPriceTestBaseOffer({ offerId: "future-49", amountCents: 4900, config })).toBe("p49");
    expect(classifyPriceTestBaseOffer({ offerId: "2151314475", amountCents: 6700, config })).toBe("p67");
    expect(classifyPriceTestBaseOffer({ offerId: "future-99", amountCents: 9900, config })).toBe("p99");
    expect(classifyPriceTestBaseOffer({ offerId: "future-49", amountCents: 6700, config })).toBeNull();
    expect(classifyPriceTestBaseOffer({ offerId: "2151333044", amountCents: 19900, config })).toBeNull();
  });

  it("retains the predeclared price values without touching the current $67 control mapping", () => {
    expect(AGORA_PRICE_ARM_SPECS.p49.priceCents).toBe(4900);
    expect(AGORA_PRICE_ARM_SPECS.p67.existingOfferId).toBe("2151314475");
    expect(AGORA_PRICE_ARM_SPECS.p99.priceCents).toBe(9900);
  });
});

