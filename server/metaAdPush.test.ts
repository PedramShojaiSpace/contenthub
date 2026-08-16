/**
 * Tests for metaAdPushRouter — validates the ad catalog structure and push logic
 */
import { describe, it, expect } from "vitest";
import { AD_CATALOG } from "./metaAdPushRouter";

describe("AD_CATALOG", () => {
  it("should have at least 5 variants (KBMO + Interconnected)", () => {
    expect(AD_CATALOG.length).toBeGreaterThanOrEqual(5);
  });

  it("should have all required KBMO variant slugs", () => {
    const slugs = AD_CATALOG.map((v) => v.variantSlug);
    expect(slugs).toContain("precision");
    expect(slugs).toContain("optimizer");
    expect(slugs).toContain("gutbrain");
    expect(slugs).toContain("autoimmune");
    expect(slugs).toContain("weight");
  });

  it("should include the Interconnected campaign", () => {
    const slugs = AD_CATALOG.map((v) => v.variantSlug);
    expect(slugs).toContain("interconnected");
  });

  it("should have non-empty image hashes for all ads", () => {
    for (const variant of AD_CATALOG) {
      for (const ad of variant.ads) {
        expect(ad.imageHash).toBeTruthy();
        expect(ad.imageHash).toMatch(/^[a-f0-9]{32}$/);
      }
    }
  });

  it("should have non-empty headlines for all ads", () => {
    for (const variant of AD_CATALOG) {
      for (const ad of variant.ads) {
        expect(ad.headline).toBeTruthy();
        expect(ad.headline.length).toBeGreaterThan(10);
      }
    }
  });

  it("should have non-empty primary text for all ads", () => {
    for (const variant of AD_CATALOG) {
      for (const ad of variant.ads) {
        expect(ad.primaryText).toBeTruthy();
        expect(ad.primaryText.length).toBeGreaterThan(100);
      }
    }
  });

  it("should have valid CTA values for all ads", () => {
    const validCtas = ["LEARN_MORE", "WATCH_MORE", "SHOP_NOW", "SIGN_UP", "GET_OFFER"];
    for (const variant of AD_CATALOG) {
      for (const ad of variant.ads) {
        expect(validCtas).toContain(ad.cta);
      }
    }
  });

  it("should have unique adIds across all variants", () => {
    const allIds = AD_CATALOG.flatMap((v) => v.ads.map((a) => a.adId));
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("should have unique image hashes across all ads", () => {
    const allHashes = AD_CATALOG.flatMap((v) => v.ads.map((a) => a.imageHash));
    const uniqueHashes = new Set(allHashes);
    expect(uniqueHashes.size).toBe(allHashes.length);
  });

  it("should have correct image file naming convention", () => {
    for (const variant of AD_CATALOG) {
      // Interconnected and Tantra variants use their own approved JPEG conventions.
      if (variant.variantSlug === "interconnected" || variant.variantSlug === "tantra") continue;
      for (const ad of variant.ads) {
        expect(ad.imageFile).toMatch(/^ad-[a-z]+-[123]\.webp$/);
        expect(ad.imageFile).toContain(variant.variantSlug);
      }
    }
  });

  it("should have variant numbers 1-7 (KBMO 1-5 + Interconnected 6 + Tantra 7)", () => {
    const nums = AD_CATALOG.map((v) => v.variantNum).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
