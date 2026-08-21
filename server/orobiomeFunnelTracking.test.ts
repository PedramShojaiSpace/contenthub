import { describe, expect, it } from "vitest";
import { buildOrobiomeTrackedCartUrl } from "./orobiomeFunnelTracking";

describe("Orobiome cart tracking permalink", () => {
  it("preserves Natalie Jill attribution while adding only anonymous cart attributes", () => {
    const href = buildOrobiomeTrackedCartUrl(
      "https://shop.theurbanmonk.com/cart/46719608946842:1?bg_ref=109Nl4h0Ds",
      { visitorId: "orob_abcdefghijklmnopqrstuv", variant: "offer_clarity", ctaPosition: "hero" }
    );
    const url = new URL(href);
    expect(url.pathname).toBe("/cart/46719608946842:1");
    expect(url.searchParams.get("bg_ref")).toBe("109Nl4h0Ds");
    expect(url.searchParams.get("attributes[orobiome_visit_id]")).toBe("orob_abcdefghijklmnopqrstuv");
    expect(url.searchParams.get("attributes[orobiome_variant]")).toBe("offer_clarity");
    expect(url.searchParams.get("attributes[orobiome_cta]")).toBe("hero");
  });
});
