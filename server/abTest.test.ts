import { describe, it, expect } from "vitest";
import {
  normalCdf,
  twoProportionZTest,
  pickVariantByWeight,
  type VariantStats,
} from "./abTestRouter";

// ─── normalCdf ────────────────────────────────────────────────────────────────

describe("normalCdf", () => {
  it("returns 0.5 for z=0", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
  });

  it("returns ~0.8413 for z=1", () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.9772 for z=2", () => {
    expect(normalCdf(2)).toBeCloseTo(0.9772, 3);
  });

  it("returns ~0.9987 for z=3", () => {
    expect(normalCdf(3)).toBeCloseTo(0.9987, 3);
  });

  it("returns symmetric values for negative z", () => {
    expect(normalCdf(-1)).toBeCloseTo(1 - normalCdf(1), 4);
    expect(normalCdf(-2)).toBeCloseTo(1 - normalCdf(2), 4);
  });
});

// ─── twoProportionZTest ───────────────────────────────────────────────────────

function makeVariant(
  id: number,
  isControl: boolean,
  exposures: number,
  conversions: number
): VariantStats {
  return {
    variantId: id,
    name: isControl ? "Control" : `Variant ${id}`,
    isControl,
    exposures,
    conversions,
    conversionRate: exposures > 0 ? conversions / exposures : 0,
    revenueCents: conversions * 36900,
    revenuePerExposure: exposures > 0 ? (conversions * 36900) / exposures : 0,
  };
}

describe("twoProportionZTest", () => {
  it("returns hasEnoughData=false when exposures below minimum", () => {
    const control = makeVariant(1, true, 100, 5);
    const treatment = makeVariant(2, false, 100, 8);
    const result = twoProportionZTest(control, treatment, 300);
    expect(result.hasEnoughData).toBe(false);
    expect(result.isSignificant).toBe(false);
  });

  it("detects significance for large lift with enough data", () => {
    // 3% vs 6% conversion rate with 1000 exposures each — should be significant
    const control = makeVariant(1, true, 1000, 30);
    const treatment = makeVariant(2, false, 1000, 60);
    const result = twoProportionZTest(control, treatment, 300, 0.95);
    expect(result.hasEnoughData).toBe(true);
    expect(result.isSignificant).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.95);
    expect(result.relativeLift).toBeCloseTo(100, 0); // 100% relative lift
  });

  it("does not declare significance for small lift with minimum data", () => {
    // 3% vs 3.1% — not significant at 300 exposures
    const control = makeVariant(1, true, 300, 9);
    const treatment = makeVariant(2, false, 300, 9);
    const result = twoProportionZTest(control, treatment, 300, 0.95);
    expect(result.hasEnoughData).toBe(true);
    expect(result.isSignificant).toBe(false);
  });

  it("returns correct controlId and treatmentId", () => {
    const control = makeVariant(10, true, 500, 25);
    const treatment = makeVariant(20, false, 500, 35);
    const result = twoProportionZTest(control, treatment, 300, 0.95);
    expect(result.controlId).toBe(10);
    expect(result.treatmentId).toBe(20);
  });

  it("handles zero conversion rate in control gracefully", () => {
    const control = makeVariant(1, true, 500, 0);
    const treatment = makeVariant(2, false, 500, 10);
    const result = twoProportionZTest(control, treatment, 300, 0.95);
    // pPool = 10/1000 = 0.01, se > 0, should not throw
    expect(result.hasEnoughData).toBe(true);
    expect(typeof result.zScore).toBe("number");
    expect(isNaN(result.zScore)).toBe(false);
  });

  it("uses custom significance threshold", () => {
    // 3% vs 4.5% with 1000 exposures — significant at 80% but not at 99%
    const control = makeVariant(1, true, 1000, 30);
    const treatment = makeVariant(2, false, 1000, 45);
    const at80 = twoProportionZTest(control, treatment, 300, 0.80);
    const at99 = twoProportionZTest(control, treatment, 300, 0.99);
    expect(at80.isSignificant).toBe(true);
    expect(at99.isSignificant).toBe(false);
  });
});

// ─── pickVariantByWeight ──────────────────────────────────────────────────────

describe("pickVariantByWeight", () => {
  it("always picks the only variant when there is one", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickVariantByWeight([42], [100])).toBe(42);
    }
  });

  it("respects 50/50 split within statistical tolerance", () => {
    const counts = { 1: 0, 2: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const pick = pickVariantByWeight([1, 2], [50, 50]);
      counts[pick as 1 | 2]++;
    }
    const ratio = counts[1] / N;
    // Should be 50% ± 2%
    expect(ratio).toBeGreaterThan(0.48);
    expect(ratio).toBeLessThan(0.52);
  });

  it("respects 80/20 split within statistical tolerance", () => {
    const counts = { 1: 0, 2: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const pick = pickVariantByWeight([1, 2], [80, 20]);
      counts[pick as 1 | 2]++;
    }
    const ratio = counts[1] / N;
    // Should be 80% ± 3%
    expect(ratio).toBeGreaterThan(0.77);
    expect(ratio).toBeLessThan(0.83);
  });

  it("returns last variant when random overshoots", () => {
    // With weight [0, 100], should always pick variant 2
    for (let i = 0; i < 20; i++) {
      expect(pickVariantByWeight([1, 2], [0, 100])).toBe(2);
    }
  });
});
