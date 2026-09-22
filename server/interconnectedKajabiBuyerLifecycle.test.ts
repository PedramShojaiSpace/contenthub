import { describe, expect, it } from "vitest";
import {
  INTERCONNECTED_KAJABI_BUYER_EVENT,
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

  it("accepts the Upstream OCU only after its exact Kajabi identifier is configured", () => {
    expect(classifyInterconnectedKajabiLifecyclePurchase({
      upsellId: "upstream-ocus-99",
      configuredUpstreamOcuOfferId: "upstream-ocus-99",
    })).toEqual({
      kind: "upstream_ocus_accepted",
      eventName: UPSTREAM_COURSE_OCU_ACCEPTED_EVENT,
      upstreamOcuOfferId: "upstream-ocus-99",
      upstreamOcuPriceCents: 9900,
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
