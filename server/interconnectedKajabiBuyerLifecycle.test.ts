import { describe, expect, it } from "vitest";
import {
  INTERCONNECTED_KAJABI_BUYER_EVENT,
  INTERCONNECTED_KAJABI_UPSTREAM_99_OCU_OFFER_ID,
  UPSTREAM_COURSE_OCU_ACCEPTED_EVENT,
  classifyInterconnectedKajabiLifecyclePurchase,
  isKajabiKlaviyoBuyerEventEnabled,
} from "./interconnectedKajabiBuyerLifecycle";

describe("Kajabi-to-Klaviyo buyer lifecycle classification", () => {
  it("classifies only the exact $67 and $99 Interconnected base offers", () => {
    expect(classifyInterconnectedKajabiLifecyclePurchase({ offerId: "2151314475" })).toEqual({
      kind: "base_buyer",
      eventName: INTERCONNECTED_KAJABI_BUYER_EVENT,
      baseOfferId: "2151314475",
      baseOfferTier: "67_control",
      baseRevenueCents: 6700,
    });
    expect(classifyInterconnectedKajabiLifecyclePurchase({ offerId: "2151402817" })).toEqual({
      kind: "base_buyer",
      eventName: INTERCONNECTED_KAJABI_BUYER_EVENT,
      baseOfferId: "2151402817",
      baseOfferTier: "99_treatment",
      baseRevenueCents: 9900,
    });
  });

  it("accepts the verified Upstream OCU only with its exact Kajabi identifier", () => {
    expect(classifyInterconnectedKajabiLifecyclePurchase({
      offerId: INTERCONNECTED_KAJABI_UPSTREAM_99_OCU_OFFER_ID,
    })).toEqual({
      kind: "upstream_ocus_accepted",
      eventName: UPSTREAM_COURSE_OCU_ACCEPTED_EVENT,
      upstreamOcuOfferId: INTERCONNECTED_KAJABI_UPSTREAM_99_OCU_OFFER_ID,
      upstreamOcuPriceCents: 9900,
    });
  });

  it("allows an explicit future identifier override without broadening price-based matching", () => {
    expect(classifyInterconnectedKajabiLifecyclePurchase({
      upsellId: "future-approved-ocus",
      configuredUpstreamOcuOfferId: "future-approved-ocus",
    })).toMatchObject({
      kind: "upstream_ocus_accepted",
      upstreamOcuOfferId: "future-approved-ocus",
    });
  });

  it("does not infer an Upstream OCU from a price, label, or generic payload", () => {
    expect(classifyInterconnectedKajabiLifecyclePurchase({ offerId: "", upsellId: "" })).toEqual({
      kind: "not_applicable",
      reason: "unconfigured_or_unrelated_offer",
    });
    expect(classifyInterconnectedKajabiLifecyclePurchase({ offerId: "999999" })).toEqual({
      kind: "not_applicable",
      reason: "unconfigured_or_unrelated_offer",
    });
  });

  it("keeps live dispatch disabled until explicitly enabled", () => {
    expect(isKajabiKlaviyoBuyerEventEnabled(undefined)).toBe(false);
    expect(isKajabiKlaviyoBuyerEventEnabled("false")).toBe(false);
    expect(isKajabiKlaviyoBuyerEventEnabled("true")).toBe(true);
  });
});
