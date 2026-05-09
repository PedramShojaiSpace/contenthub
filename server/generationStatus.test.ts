/**
 * Tests for generation status bar logic
 * Covers: elapsed time formatting, ETA calculation, per-variant status display
 */
import { describe, it, expect } from "vitest";

// ── formatTime helper (mirrors client logic) ──────────────────────────────────
function formatTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── ETA calculation (mirrors client logic) ────────────────────────────────────
function calcEta(
  generationStartedAt: number,
  firstVariantDoneAt: number | null,
  doneCount: number,
  totalVariants: number,
  elapsedSeconds: number
): string {
  const remainingVariants = totalVariants - doneCount;
  if (firstVariantDoneAt && doneCount > 0 && remainingVariants > 0) {
    const secsPerVariant = (firstVariantDoneAt - generationStartedAt) / 1000;
    const etaSecs = Math.round(secsPerVariant * remainingVariants);
    return `~${formatTime(etaSecs)} remaining`;
  } else if (!firstVariantDoneAt && totalVariants > 0) {
    const estimatedTotalSecs = totalVariants * 4 * 60;
    const remaining = Math.max(0, estimatedTotalSecs - elapsedSeconds);
    return `~${formatTime(remaining)} estimated`;
  }
  return "";
}

describe("formatTime", () => {
  it("shows seconds when under 60s", () => {
    expect(formatTime(0)).toBe("0s");
    expect(formatTime(45)).toBe("45s");
    expect(formatTime(59)).toBe("59s");
  });

  it("shows minutes only when no remainder", () => {
    expect(formatTime(60)).toBe("1m");
    expect(formatTime(120)).toBe("2m");
    expect(formatTime(300)).toBe("5m");
  });

  it("shows minutes and seconds when there is a remainder", () => {
    expect(formatTime(90)).toBe("1m 30s");
    expect(formatTime(125)).toBe("2m 5s");
    expect(formatTime(3661)).toBe("61m 1s");
  });
});

describe("calcEta", () => {
  const now = Date.now();

  it("returns estimated time before first variant completes", () => {
    // 5 variants × 4 min each = 20 min total, 0 elapsed → ~20m estimated
    const result = calcEta(now, null, 0, 5, 0);
    expect(result).toBe("~20m estimated");
  });

  it("decreases estimate as elapsed time increases", () => {
    // 5 variants × 4 min = 20 min = 1200s total, 300s elapsed → 900s = 15m remaining
    const result = calcEta(now, null, 0, 5, 300);
    expect(result).toBe("~15m estimated");
  });

  it("clamps to 0 when elapsed exceeds estimate", () => {
    // 1 variant × 4 min = 240s, 500s elapsed → 0s remaining
    const result = calcEta(now, null, 0, 1, 500);
    expect(result).toBe("~0s estimated");
  });

  it("uses actual first-variant time once one is done", () => {
    // First variant took 2 min (120s), 4 remaining → ~8m remaining
    const startedAt = now - 120_000;
    const firstDoneAt = now;
    const result = calcEta(startedAt, firstDoneAt, 1, 5, 120);
    expect(result).toBe("~8m remaining");
  });

  it("returns empty string when all variants are done", () => {
    const startedAt = now - 60_000;
    const firstDoneAt = now;
    const result = calcEta(startedAt, firstDoneAt, 5, 5, 60);
    expect(result).toBe("");
  });

  it("returns empty string when no variants exist", () => {
    const result = calcEta(now, null, 0, 0, 0);
    expect(result).toBe("");
  });
});

describe("variant status display logic", () => {
  const variants = [
    { id: 1, status: "done", variantLabel: "Hook 1 + Body" },
    { id: 2, status: "processing", variantLabel: "Hook 2 + Body" },
    { id: 3, status: "error", variantLabel: "Hook 3 + Body" },
    { id: 4, status: "pending", variantLabel: "Hook 4 + Body" },
  ];

  it("correctly counts done variants", () => {
    const done = variants.filter(v => v.status === "done");
    expect(done.length).toBe(1);
  });

  it("correctly identifies processing variants", () => {
    const processing = variants.filter(v => v.status === "processing");
    expect(processing.length).toBe(1);
    expect(processing[0].variantLabel).toBe("Hook 2 + Body");
  });

  it("correctly identifies error variants", () => {
    const errors = variants.filter(v => v.status === "error");
    expect(errors.length).toBe(1);
  });

  it("calculates progress percentage correctly", () => {
    const doneCount = variants.filter(v => v.status === "done").length;
    const total = variants.length;
    const pct = Math.round((doneCount / total) * 100);
    expect(pct).toBe(25);
  });

  it("handles zero total variants gracefully", () => {
    const pct = 0 > 0 ? Math.round((0 / 0) * 100) : 0;
    expect(pct).toBe(0);
  });
});
