/**
 * Draft-only configuration contract for the Agora Kajabi entry-price test.
 *
 * This module deliberately contains no Kajabi write, routing, allocation, or
 * activation behavior. It defines what must be true before a separate,
 * owner-approved implementation may create offers or expose traffic to a test.
 */

export const AGORA_PRICE_TEST_ID = "agora-entry-price-v1" as const;

export const AGORA_PRICE_ARM_SPECS = {
  p49: { armId: "p49", label: "$49 treatment", priceCents: 4900, isControl: false },
  p67: {
    armId: "p67",
    label: "$67 current control",
    priceCents: 6700,
    isControl: true,
    existingOfferId: "2151314475",
  },
  p99: { armId: "p99", label: "$99 treatment", priceCents: 9900, isControl: false },
} as const;

export type AgoraPriceArmId = keyof typeof AGORA_PRICE_ARM_SPECS;

export const CURRENT_INTERCONNECTED_OCUS_CONTRACT = {
  offerId: "2151333044",
  priceCents: 19900,
  label: "Gut Permeability + Food Sensitivity Test w/ Coach ($199 OCUS)",
  // This is intentionally false until each entry Offer has been checked in
  // Kajabi. A shared $199 Offer ID does not prove equivalent eligibility.
  equivalenceVerifiedForAllPriceArms: false,
} as const;

export interface ResolvedPriceTestArm {
  armId: AgoraPriceArmId;
  label: string;
  priceCents: number;
  offerId: string;
  isControl: boolean;
}

export interface ResolvedPriceTestMeasurementConfig {
  testId: typeof AGORA_PRICE_TEST_ID;
  status: "draft";
  arms: ResolvedPriceTestArm[];
  ocusOfferId: string;
  ocusPriceCents: number;
  ocusEquivalenceVerified: boolean;
}

/**
 * Return a public-safe readiness snapshot. Any false condition is an explicit
 * activation blocker; callers must not infer missing offer IDs from price.
 */
export function getAgoraPriceTestDraftReadiness() {
  return {
    testId: AGORA_PRICE_TEST_ID,
    status: "draft" as const,
    trafficAllocationActive: false,
    externalOffersCreated: false,
    priceArms: Object.values(AGORA_PRICE_ARM_SPECS).map((arm) => ({
      armId: arm.armId,
      label: arm.label,
      priceCents: arm.priceCents,
      offerId: "existingOfferId" in arm ? arm.existingOfferId : null,
      mapped: "existingOfferId" in arm,
    })),
    ocus: CURRENT_INTERCONNECTED_OCUS_CONTRACT,
    blockers: [
      "$49 Kajabi Offer has not been created or mapped to an exact Offer ID.",
      "$99 Kajabi Offer has not been created or mapped to an exact Offer ID.",
      "The $199 OCUS eligibility and price equivalence has not been verified for every entry-price arm.",
      "No sticky public price allocation or assigned page-to-checkout mapping has been approved or activated.",
      "Exact-offer price-arm reporting and refund reconciliation must be confirmed against the approved live offers before activation.",
    ],
  };
}

/**
 * Convert only explicit, exact Offer IDs into a measurement contract. This
 * rejects missing and duplicated Offer IDs so a caller cannot match revenue by
 * dollar amount or accidentally pool price arms.
 */
export function resolvePriceTestMeasurementConfig(input: {
  offerIds: Record<AgoraPriceArmId, string | undefined>;
  ocusOfferId: string | undefined;
  ocusEquivalenceVerified: boolean;
}): ResolvedPriceTestMeasurementConfig {
  const arms = (Object.keys(AGORA_PRICE_ARM_SPECS) as AgoraPriceArmId[]).map((armId) => {
    const spec = AGORA_PRICE_ARM_SPECS[armId];
    const offerId = input.offerIds[armId]?.trim();
    if (!offerId) {
      throw new Error(`Exact Kajabi Offer ID is required for ${spec.label}.`);
    }
    return {
      armId,
      label: spec.label,
      priceCents: spec.priceCents,
      offerId,
      isControl: spec.isControl,
    };
  });

  const uniqueOfferIds = new Set(arms.map((arm) => arm.offerId));
  if (uniqueOfferIds.size !== arms.length) {
    throw new Error("Each price arm requires a different exact Kajabi Offer ID.");
  }

  const ocusOfferId = input.ocusOfferId?.trim();
  if (!ocusOfferId) {
    throw new Error("The exact $199 OCUS Offer ID is required.");
  }
  if (!input.ocusEquivalenceVerified) {
    throw new Error("$199 OCUS equivalence must be verified for every entry-price arm before activation.");
  }

  return {
    testId: AGORA_PRICE_TEST_ID,
    status: "draft",
    arms,
    ocusOfferId,
    ocusPriceCents: CURRENT_INTERCONNECTED_OCUS_CONTRACT.priceCents,
    ocusEquivalenceVerified: true,
  };
}

/**
 * A deliberately narrow transaction classifier for price-test base offers.
 * It never attributes the shared $199 OCUS to a price arm because Kajabi
 * transaction rows alone do not prove which base arm created eligibility.
 */
export function classifyPriceTestBaseOffer(input: {
  offerId: string;
  amountCents: number;
  config: ResolvedPriceTestMeasurementConfig;
}): AgoraPriceArmId | null {
  const match = input.config.arms.find(
    (arm) => arm.offerId === input.offerId && arm.priceCents === input.amountCents,
  );
  return match?.armId ?? null;
}

