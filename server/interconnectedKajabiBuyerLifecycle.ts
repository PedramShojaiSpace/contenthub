export const INTERCONNECTED_KAJABI_BUYER_EVENT = "Interconnected Kajabi Buyer";
export const UPSTREAM_COURSE_OCU_ACCEPTED_EVENT = "Upstream Course OCU Accepted";
export const INTERCONNECTED_KAJABI_UPSTREAM_99_OCU_OFFER_ID = "2151104453";

export const INTERCONNECTED_KAJABI_BASE_OFFERS = {
  "2151314475": {
    tier: "67_control",
    priceCents: 6700,
  },
  "2151402817": {
    tier: "99_treatment",
    priceCents: 9900,
  },
} as const;

export type InterconnectedKajabiBuyerTier =
  (typeof INTERCONNECTED_KAJABI_BASE_OFFERS)[keyof typeof INTERCONNECTED_KAJABI_BASE_OFFERS]["tier"];

export type InterconnectedKajabiLifecycleClassification =
  | {
      kind: "base_buyer";
      eventName: typeof INTERCONNECTED_KAJABI_BUYER_EVENT;
      baseOfferId: keyof typeof INTERCONNECTED_KAJABI_BASE_OFFERS;
      baseOfferTier: InterconnectedKajabiBuyerTier;
      baseRevenueCents: number;
    }
  | {
      kind: "upstream_ocus_accepted";
      eventName: typeof UPSTREAM_COURSE_OCU_ACCEPTED_EVENT;
      upstreamOcuOfferId: string;
      upstreamOcuPriceCents: 9900;
    }
  | {
      kind: "not_applicable";
      reason: "unconfigured_or_unrelated_offer";
    };

/**
 * Classifies only known exact identifiers. Never infer a paid buyer or the
 * Upstream OCU from a price or from a generic Kajabi webhook payload.
 */
export function classifyInterconnectedKajabiLifecyclePurchase(input: {
  offerId?: string | null;
  upsellId?: string | null;
  configuredUpstreamOcuOfferId?: string | null;
}): InterconnectedKajabiLifecycleClassification {
  const offerId = input.offerId?.trim() ?? "";
  const upsellId = input.upsellId?.trim() ?? "";
  const baseOffer = INTERCONNECTED_KAJABI_BASE_OFFERS[
    offerId as keyof typeof INTERCONNECTED_KAJABI_BASE_OFFERS
  ];

  if (baseOffer) {
    return {
      kind: "base_buyer",
      eventName: INTERCONNECTED_KAJABI_BUYER_EVENT,
      baseOfferId: offerId as keyof typeof INTERCONNECTED_KAJABI_BASE_OFFERS,
      baseOfferTier: baseOffer.tier,
      baseRevenueCents: baseOffer.priceCents,
    };
  }

  // This is the verified live Kajabi $99 OCU. An environment value may override
  // it only if the offer is intentionally replaced in a future approved test.
  const upstreamOcuOfferId = input.configuredUpstreamOcuOfferId?.trim()
    || INTERCONNECTED_KAJABI_UPSTREAM_99_OCU_OFFER_ID;
  if (offerId === upstreamOcuOfferId || upsellId === upstreamOcuOfferId) {
    return {
      kind: "upstream_ocus_accepted",
      eventName: UPSTREAM_COURSE_OCU_ACCEPTED_EVENT,
      upstreamOcuOfferId,
      upstreamOcuPriceCents: 9900,
    };
  }

  return { kind: "not_applicable", reason: "unconfigured_or_unrelated_offer" };
}

/**
 * Live dispatch remains opt-in while the Klaviyo buyer flow is reviewed. This
 * is intentionally not a default-on migration switch.
 */
export function isKajabiKlaviyoBuyerEventEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
