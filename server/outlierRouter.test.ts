/**
 * Outlier Detector — Phase B Tests
 *
 * Tests the pure math functions (computeStats, zScore, computeOutlierScore,
 * computeRetentionScore) using fixture data only — no DB or network calls.
 */

import { describe, expect, it } from "vitest";
import {
  computeOutlierScore,
  computeStats,
  zScore,
  computeRetentionScore,
} from "./outlierRouter";

// ─── computeStats ─────────────────────────────────────────────────────────────

describe("computeStats", () => {
  it("returns zero mean and stddev for empty array", () => {
    const result = computeStats([]);
    expect(result.mean).toBe(0);
    expect(result.stddev).toBe(0);
  });

  it("returns correct mean for single value", () => {
    const result = computeStats([0.05]);
    expect(result.mean).toBeCloseTo(0.05);
    expect(result.stddev).toBe(0);
  });

  it("returns correct mean for uniform values", () => {
    const result = computeStats([0.04, 0.04, 0.04, 0.04]);
    expect(result.mean).toBeCloseTo(0.04);
    expect(result.stddev).toBeCloseTo(0);
  });

  it("computes correct mean for known values", () => {
    // [0.02, 0.04, 0.06] → mean = 0.04
    const result = computeStats([0.02, 0.04, 0.06]);
    expect(result.mean).toBeCloseTo(0.04);
  });

  it("computes correct population stddev for known values", () => {
    // [0.02, 0.04, 0.06] → variance = ((0.02)^2 + 0 + (0.02)^2) / 3 ≈ 0.000267
    // stddev ≈ 0.01633
    const result = computeStats([0.02, 0.04, 0.06]);
    expect(result.stddev).toBeCloseTo(0.01633, 3);
  });

  it("handles large arrays correctly", () => {
    const values = Array.from({ length: 100 }, (_, i) => i / 100);
    const result = computeStats(values);
    expect(result.mean).toBeCloseTo(0.495, 2);
    expect(result.stddev).toBeGreaterThan(0);
  });

  it("handles negative values", () => {
    const result = computeStats([-1, 0, 1]);
    expect(result.mean).toBeCloseTo(0);
    expect(result.stddev).toBeCloseTo(0.8165, 3);
  });
});

// ─── zScore ───────────────────────────────────────────────────────────────────

describe("zScore", () => {
  it("returns 0 when stddev is 0", () => {
    expect(zScore(0.05, 0.05, 0)).toBe(0);
    expect(zScore(0.10, 0.05, 0)).toBe(0);
  });

  it("returns 0 when value equals mean", () => {
    expect(zScore(0.05, 0.05, 0.01)).toBeCloseTo(0);
  });

  it("returns positive z-score for above-average value", () => {
    // value = 0.08, mean = 0.04, stddev = 0.02 → z = 2.0
    expect(zScore(0.08, 0.04, 0.02)).toBeCloseTo(2.0);
  });

  it("returns negative z-score for below-average value", () => {
    // value = 0.02, mean = 0.04, stddev = 0.02 → z = -1.0
    expect(zScore(0.02, 0.04, 0.02)).toBeCloseTo(-1.0);
  });

  it("returns 1.5 for 1.5σ above mean", () => {
    expect(zScore(0.07, 0.04, 0.02)).toBeCloseTo(1.5);
  });

  it("handles very small stddev without dividing by zero", () => {
    const result = zScore(0.041, 0.04, 0.0001);
    expect(isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(10.0, 0);
  });
});

// ─── computeOutlierScore ──────────────────────────────────────────────────────

describe("computeOutlierScore", () => {
  it("returns 0 for two zero z-scores", () => {
    expect(computeOutlierScore(0, 0)).toBe(0);
  });

  it("returns average of absolute z-scores", () => {
    // (|2.0| + |1.0|) / 2 = 1.5
    expect(computeOutlierScore(2.0, 1.0)).toBeCloseTo(1.5);
  });

  it("uses absolute values — negative z-scores count equally", () => {
    // (|-2.0| + |-1.0|) / 2 = 1.5
    expect(computeOutlierScore(-2.0, -1.0)).toBeCloseTo(1.5);
  });

  it("mixed signs are averaged by absolute value", () => {
    // (|2.0| + |-2.0|) / 2 = 2.0
    expect(computeOutlierScore(2.0, -2.0)).toBeCloseTo(2.0);
  });

  it("threshold: score >= 1.5 should be flagged as outlier", () => {
    const THRESHOLD = 1.5;
    expect(computeOutlierScore(2.0, 1.0)).toBeGreaterThanOrEqual(THRESHOLD);
    expect(computeOutlierScore(0.5, 0.5)).toBeLessThan(THRESHOLD);
  });

  it("single-dimension outlier (one z is high, other is 0) can still exceed threshold", () => {
    // (3.0 + 0) / 2 = 1.5 — exactly at threshold
    expect(computeOutlierScore(3.0, 0)).toBeCloseTo(1.5);
  });
});

// ─── computeRetentionScore ────────────────────────────────────────────────────

describe("computeRetentionScore", () => {
  it("returns null when video duration is 0", () => {
    expect(computeRetentionScore(120, 0)).toBeNull();
  });

  it("returns null when avg view duration is 0", () => {
    expect(computeRetentionScore(0, 600)).toBeNull();
  });

  it("returns null when both are 0", () => {
    expect(computeRetentionScore(0, 0)).toBeNull();
  });

  it("returns correct ratio for 50% retention", () => {
    // 300s avg / 600s video = 0.5
    expect(computeRetentionScore(300, 600)).toBeCloseTo(0.5);
  });

  it("caps at 1.0 for avg > duration (data anomaly)", () => {
    // 700s avg / 600s video → capped at 1.0
    expect(computeRetentionScore(700, 600)).toBeCloseTo(1.0);
  });

  it("returns close to 1.0 for near-full retention", () => {
    expect(computeRetentionScore(590, 600)).toBeCloseTo(0.9833, 3);
  });

  it("returns very low value for low retention", () => {
    // 30s avg / 600s video = 0.05
    expect(computeRetentionScore(30, 600)).toBeCloseTo(0.05);
  });
});

// ─── Integration: end-to-end outlier detection scenario ──────────────────────

describe("Outlier detection end-to-end (fixture)", () => {
  it("correctly identifies a high-CTR video as an outlier", () => {
    // Baseline: mean CTR = 4%, stddev = 1%
    // Video CTR = 8% → z = (0.08 - 0.04) / 0.01 = 4.0
    // Retention z = 0 (at baseline)
    // outlierScore = (4.0 + 0) / 2 = 2.0 ≥ 1.5 → outlier
    const ctrZ = zScore(0.08, 0.04, 0.01);
    const retZ = zScore(0.45, 0.45, 0.05);
    const score = computeOutlierScore(ctrZ, retZ);
    expect(score).toBeGreaterThanOrEqual(1.5);
  });

  it("correctly marks an average video as non-outlier", () => {
    // CTR at mean, retention at mean → both z = 0 → score = 0
    const ctrZ = zScore(0.04, 0.04, 0.01);
    const retZ = zScore(0.45, 0.45, 0.05);
    const score = computeOutlierScore(ctrZ, retZ);
    expect(score).toBeLessThan(1.5);
  });

  it("correctly identifies a high-retention video as an outlier", () => {
    // Baseline: mean retention = 40%, stddev = 5%
    // Video retention = 65% → z = (0.65 - 0.40) / 0.05 = 5.0
    // CTR z = 0 (at baseline)
    // outlierScore = (0 + 5.0) / 2 = 2.5 ≥ 1.5 → outlier
    const ctrZ = zScore(0.04, 0.04, 0.01);
    const retZ = zScore(0.65, 0.40, 0.05);
    const score = computeOutlierScore(ctrZ, retZ);
    expect(score).toBeGreaterThanOrEqual(1.5);
  });

  it("handles a video with no snapshot data gracefully", () => {
    // If both CTR and retention are at the mean, score = 0
    const ctrZ = zScore(0.04, 0.04, 0.01);
    const retZ = zScore(0.40, 0.40, 0.05);
    const score = computeOutlierScore(ctrZ, retZ);
    expect(score).toBeCloseTo(0);
  });
});
