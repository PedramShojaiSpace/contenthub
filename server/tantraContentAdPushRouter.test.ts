import { describe, expect, it } from "vitest";
import { TANTRA_CONTENT_AD_VARIANTS } from "../shared/tantraContentAds";

describe("content-page paused-draft catalog", () => {
  it("keeps each package limited to a single $2/day ad-set test with three paused-ready creatives", () => {
    expect(TANTRA_CONTENT_AD_VARIANTS).toHaveLength(7);
    for (const variant of TANTRA_CONTENT_AD_VARIANTS) {
      expect(variant.ads).toHaveLength(3);
      expect(variant.destinationBaseUrl).toMatch(/^https:\/\/content\.theurbanmonk\.com\/tantra\//);
      expect(variant.ads.every((ad) => ad.cta === "LEARN_MORE")).toBe(true);
    }
  });
});
