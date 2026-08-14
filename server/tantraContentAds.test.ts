import { describe, expect, it } from "vitest";
import { TANTRA_CONTENT_AD_TOTAL, TANTRA_CONTENT_AD_VARIANTS } from "../shared/tantraContentAds";

describe("Tantra content-first ad workspace catalog", () => {
  it("contains seven educational destinations with three tracked creative packages each", () => {
    expect(TANTRA_CONTENT_AD_VARIANTS).toHaveLength(7);
    expect(TANTRA_CONTENT_AD_TOTAL).toBe(21);
    for (const variant of TANTRA_CONTENT_AD_VARIANTS) {
      expect(variant.ads).toHaveLength(3);
      expect(variant.imageUrl).toMatch(/^\/manus-storage\//);
      for (const creative of variant.ads) {
        expect(creative.destinationUrl).toContain("utm_source=meta");
        expect(creative.destinationUrl).toContain("utm_campaign=tantra_content_education");
        expect(creative.cta).toBe("LEARN_MORE");
      }
    }
  });
});
