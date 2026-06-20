/**
 * Tests for metaAdPushRouter — validates the ad catalog structure and push logic
 */
import { describe, it, expect } from "vitest";
import { AD_CATALOG } from "./metaAdPushRouter";

describe("AD_CATALOG", () => {
  it("should have exactly 5 variants", () => {
    expect(AD_CATALOG).toHaveLength(5);
  });

  it("should have exactly 3 ads per variant", () => {
    for (const variant of AD_CATALOG) {
      expect(variant.ads).toHaveLength(3);
    }
  });

  it("should have 15 total ads", () => {
    const total = AD_CATALOG.reduce((sum, v) => sum + v.ads.length, 0);
    expect(total).toBe(15);
  });

  it("should have all required variant slugs", () => {
    const slugs = AD_CATALOG.map((v) => v.variantSlug);
    expect(slugs).toContain("precision");
    expect(slugs).toContain("optimizer");
    expect(slugs).toContain("gutbrain");
    expect(slugs).toContain("autoimmune");
    expect(slugs).toContain("weight");
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
      for (const ad of variant.ads) {
        expect(ad.imageFile).toMatch(/^ad-[a-z]+-[123]\.webp$/);
        expect(ad.imageFile).toContain(variant.variantSlug);
      }
    }
  });

  it("should have variant numbers 1-5", () => {
    const nums = AD_CATALOG.map((v) => v.variantNum).sort();
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });
});
