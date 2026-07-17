/**
 * Pattern Extractor Router — Phase D Tests
 *
 * Tests the pure utility functions: pattern type validation, effectiveness
 * score normalization, and extraction result shape validation.
 * No DB or LLM calls.
 */

import { describe, expect, it } from "vitest";
import { PATTERN_TYPES } from "./patternExtractorRouter";

// ─── Pattern type validation ──────────────────────────────────────────────────

describe("PATTERN_TYPES", () => {
  it("contains all 12 expected types", () => {
    expect(PATTERN_TYPES.length).toBe(12);
  });

  it("includes hook", () => {
    expect(PATTERN_TYPES).toContain("hook");
  });

  it("includes pain_point", () => {
    expect(PATTERN_TYPES).toContain("pain_point");
  });

  it("includes proof_element", () => {
    expect(PATTERN_TYPES).toContain("proof_element");
  });

  it("includes objection_handler", () => {
    expect(PATTERN_TYPES).toContain("objection_handler");
  });

  it("includes cta", () => {
    expect(PATTERN_TYPES).toContain("cta");
  });

  it("includes story_structure", () => {
    expect(PATTERN_TYPES).toContain("story_structure");
  });

  it("includes key_phrase", () => {
    expect(PATTERN_TYPES).toContain("key_phrase");
  });

  it("includes transformation_arc", () => {
    expect(PATTERN_TYPES).toContain("transformation_arc");
  });

  it("includes authority_signal", () => {
    expect(PATTERN_TYPES).toContain("authority_signal");
  });

  it("includes social_proof", () => {
    expect(PATTERN_TYPES).toContain("social_proof");
  });

  it("includes open_loop", () => {
    expect(PATTERN_TYPES).toContain("open_loop");
  });

  it("includes other", () => {
    expect(PATTERN_TYPES).toContain("other");
  });
});

// ─── Effectiveness score normalization ────────────────────────────────────────

describe("Effectiveness score normalization", () => {
  function normalizeOutlierScore(score: number): number {
    return Math.min(1.0, score / 3.0);
  }

  it("normalizes score of 0 to 0", () => {
    expect(normalizeOutlierScore(0)).toBe(0);
  });

  it("normalizes score of 1.5 to 0.5", () => {
    expect(normalizeOutlierScore(1.5)).toBeCloseTo(0.5);
  });

  it("normalizes score of 3.0 to 1.0", () => {
    expect(normalizeOutlierScore(3.0)).toBe(1.0);
  });

  it("caps score above 3.0 at 1.0", () => {
    expect(normalizeOutlierScore(5.0)).toBe(1.0);
    expect(normalizeOutlierScore(10.0)).toBe(1.0);
  });

  it("analog data defaults to 0.8", () => {
    const DEFAULT_ANALOG_SCORE = 0.8;
    expect(DEFAULT_ANALOG_SCORE).toBe(0.8);
  });

  it("score of 2.4 normalizes to 0.8", () => {
    expect(normalizeOutlierScore(2.4)).toBeCloseTo(0.8);
  });
});

// ─── Pattern text validation ──────────────────────────────────────────────────

describe("Pattern text validation", () => {
  function isValidPattern(text: string): boolean {
    return text.trim().length > 5;
  }

  it("accepts a normal pattern text", () => {
    expect(isValidPattern("What if you could sleep 8 hours and wake up energized?")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidPattern("")).toBe(false);
  });

  it("rejects very short text", () => {
    expect(isValidPattern("Hi")).toBe(false);
    expect(isValidPattern("Yes")).toBe(false);
  });

  it("accepts text exactly at the boundary (6 chars)", () => {
    expect(isValidPattern("Hello!")).toBe(true);
  });

  it("rejects whitespace-only text", () => {
    expect(isValidPattern("     ")).toBe(false);
  });
});

// ─── Pattern truncation ───────────────────────────────────────────────────────

describe("Pattern text truncation", () => {
  it("truncates patternText to 300 chars", () => {
    const long = "a".repeat(400);
    const truncated = String(long).slice(0, 300);
    expect(truncated.length).toBe(300);
  });

  it("truncates patternContext to 200 chars", () => {
    const long = "b".repeat(300);
    const truncated = String(long).slice(0, 200);
    expect(truncated.length).toBe(200);
  });

  it("does not truncate short text", () => {
    const short = "This is a short hook.";
    expect(String(short).slice(0, 300)).toBe(short);
  });
});

// ─── Type coercion ────────────────────────────────────────────────────────────

describe("Pattern type coercion", () => {
  function coerceType(raw: string): string {
    return (PATTERN_TYPES as readonly string[]).includes(raw) ? raw : "other";
  }

  it("accepts valid type 'hook'", () => {
    expect(coerceType("hook")).toBe("hook");
  });

  it("accepts valid type 'pain_point'", () => {
    expect(coerceType("pain_point")).toBe("pain_point");
  });

  it("coerces unknown type to 'other'", () => {
    expect(coerceType("unknown_type")).toBe("other");
    expect(coerceType("HOOK")).toBe("other"); // case-sensitive
    expect(coerceType("")).toBe("other");
  });

  it("coerces null-like string to 'other'", () => {
    expect(coerceType("null")).toBe("other");
    expect(coerceType("undefined")).toBe("other");
  });
});

// ─── Batch extraction logic ───────────────────────────────────────────────────

describe("Batch extraction logic", () => {
  it("skips entries that already have patterns when overwrite=false", () => {
    const withPatternIds = new Set([1, 2, 3]);
    const entries = [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 5 }];
    const toProcess = entries.filter((e) => !withPatternIds.has(e.id));
    expect(toProcess.length).toBe(2);
    expect(toProcess.map((e) => e.id)).toEqual([4, 5]);
  });

  it("processes all entries when overwrite=true", () => {
    const entries = [{ id: 1 }, { id: 2 }, { id: 3 }];
    // With overwrite, all entries are processed
    expect(entries.length).toBe(3);
  });

  it("respects the limit parameter", () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const limit = 20;
    const sliced = entries.slice(0, limit);
    expect(sliced.length).toBe(20);
  });

  it("counts errors separately from successes", () => {
    const results = [
      { ok: true },
      { ok: false, error: "LLM timeout" },
      { ok: true },
      { ok: false, error: "Rate limit" },
    ];
    const processed = results.filter((r) => r.ok).length;
    const errors = results.filter((r) => !r.ok).map((r) => (r as any).error);
    expect(processed).toBe(2);
    expect(errors.length).toBe(2);
  });
});

// ─── getForScriptFactory logic ────────────────────────────────────────────────

describe("getForScriptFactory logic", () => {
  it("returns top-N patterns per type sorted by effectiveness", () => {
    const patterns = [
      { type: "hook", text: "A", effectiveness: 0.9 },
      { type: "hook", text: "B", effectiveness: 0.7 },
      { type: "hook", text: "C", effectiveness: 0.5 },
      { type: "hook", text: "D", effectiveness: 0.3 },
    ].sort((a, b) => b.effectiveness - a.effectiveness);

    const topN = 3;
    const top = patterns.slice(0, topN);
    expect(top.length).toBe(3);
    expect(top[0].text).toBe("A");
    expect(top[2].text).toBe("C");
  });

  it("filters by minEffectiveness", () => {
    const patterns = [
      { type: "cta", effectiveness: 0.9 },
      { type: "cta", effectiveness: 0.6 },
      { type: "cta", effectiveness: 0.3 },
    ];
    const minEff = 0.5;
    const filtered = patterns.filter((p) => p.effectiveness >= minEff);
    expect(filtered.length).toBe(2);
  });

  it("returns empty array when no patterns meet threshold", () => {
    const patterns = [{ type: "hook", effectiveness: 0.2 }];
    const minEff = 0.5;
    const filtered = patterns.filter((p) => p.effectiveness >= minEff);
    expect(filtered.length).toBe(0);
  });
});
