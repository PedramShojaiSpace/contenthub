import { describe, expect, it } from "vitest";
import {
  KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID,
  KAJABI_INTERCONNECTED_199_UPSELL_ID,
  KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID,
  isKnownInterconnectedKajabiOcu,
  isInterconnectedKajabiAmount,
  resolveGenericKajabiUpsellCents,
  resolveKajabiKnownPriceCents,
} from "./interconnectedUpsellAttribution";

describe("Interconnected Kajabi OCU attribution", () => {
  it("recognizes each current post-purchase offer by its exact identifier", () => {
    expect(resolveKajabiKnownPriceCents({ offerId: KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID })).toBe(9900);
    expect(resolveKajabiKnownPriceCents({ offerId: KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID })).toBe(19900);
    expect(resolveKajabiKnownPriceCents({ upsellId: KAJABI_INTERCONNECTED_199_UPSELL_ID })).toBe(19900);
    expect(isKnownInterconnectedKajabiOcu({ offerId: KAJABI_INTERCONNECTED_99_UPSTREAM_OCU_OFFER_ID })).toBe(true);
    expect(isKnownInterconnectedKajabiOcu({ offerId: KAJABI_INTERCONNECTED_199_TESTING_OCU_OFFER_ID })).toBe(true);
  });

  it("does not invent $99 or $199 revenue from an ambiguous zero-value post-purchase payload", () => {
    expect(resolveGenericKajabiUpsellCents({ rawAmountCents: 0, knownPriceCents: 0, hasPriorInterconnectedPurchase: true })).toBe(0);
    expect(resolveGenericKajabiUpsellCents({ rawAmountCents: 0, knownPriceCents: 0, hasPriorInterconnectedPurchase: false })).toBe(6700);
  });

  it("includes both current OCUs in Interconnected revenue calculations", () => {
    expect(isInterconnectedKajabiAmount(9900)).toBe(true);
    expect(isInterconnectedKajabiAmount(19900)).toBe(true);
  });
});
