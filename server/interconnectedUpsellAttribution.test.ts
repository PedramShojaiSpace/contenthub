import { describe, expect, it } from "vitest";
import {
  KAJABI_INTERCONNECTED_199_UPSELL_ID,
  isInterconnectedKajabiAmount,
  resolveGenericKajabiUpsellCents,
  resolveKajabiKnownPriceCents,
} from "./interconnectedUpsellAttribution";

describe("Interconnected $199 Kajabi upsell attribution", () => {
  it("recognizes the new $199 Kajabi upsell path by its supplied identifier", () => {
    expect(resolveKajabiKnownPriceCents({ upsellId: KAJABI_INTERCONNECTED_199_UPSELL_ID })).toBe(19900);
  });

  it("treats a generic zero-dollar one-click purchase after the $67 offer as the active $199 OCU", () => {
    expect(resolveGenericKajabiUpsellCents({ rawAmountCents: 0, knownPriceCents: 0, hasPriorInterconnectedPurchase: true })).toBe(19900);
    expect(resolveGenericKajabiUpsellCents({ rawAmountCents: 0, knownPriceCents: 0, hasPriorInterconnectedPurchase: false })).toBe(6700);
  });

  it("includes the $199 OCU in Interconnected revenue calculations", () => {
    expect(isInterconnectedKajabiAmount(19900)).toBe(true);
  });
});
