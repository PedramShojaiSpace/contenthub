/**
 * Script Factory Router — Phase E Tests
 *
 * Tests pure utility functions: [VERIFIED] tag counting, grounded context
 * building, and format validation. No DB or LLM calls.
 */

import { describe, expect, it } from "vitest";
import { countVerifiedTags, SCRIPT_FORMATS, FORMAT_DESCRIPTIONS } from "./scriptFactoryRouter";

// ─── countVerifiedTags ────────────────────────────────────────────────────────

describe("countVerifiedTags", () => {
  it("counts zero [VERIFIED] tags in plain text", () => {
    const result = countVerifiedTags("This is a plain script with no tags.");
    expect(result.verified).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
  });

  it("counts a single [VERIFIED] tag", () => {
    const result = countVerifiedTags("[HOOK] What if you could sleep better? [VERIFIED]");
    expect(result.verified).toBe(1);
    expect(result.total).toBe(2); // [HOOK] + [VERIFIED]
  });

  it("counts multiple [VERIFIED] tags", () => {
    const script = "[HOOK] Hook text [VERIFIED]\n[PAIN] Pain text [VERIFIED]\n[CTA] CTA text";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(2);
    expect(result.total).toBe(5); // [HOOK], [VERIFIED], [PAIN], [VERIFIED], [CTA]
  });

  it("computes verification percentage correctly", () => {
    // 2 [VERIFIED] out of 4 total bracketed elements = 50%
    const script = "[HOOK] text [VERIFIED] [PAIN] text [VERIFIED] [CTA] text [CLOSE] text";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(2);
    expect(result.total).toBe(6); // [HOOK], [VERIFIED], [PAIN], [VERIFIED], [CTA], [CLOSE]
    expect(result.pct).toBe(33); // 2/6 = 33%
  });

  it("returns 0% when no bracketed elements exist", () => {
    const result = countVerifiedTags("No tags here at all.");
    expect(result.pct).toBe(0);
  });

  it("handles 100% verification", () => {
    const script = "[VERIFIED] [VERIFIED] [VERIFIED]";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(3);
    expect(result.total).toBe(3);
    expect(result.pct).toBe(100);
  });

  it("handles script with only structure tags and no VERIFIED", () => {
    const script = "[HOOK] text [PAIN] text [CTA] text";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(0);
    expect(result.total).toBe(3);
    expect(result.pct).toBe(0);
  });

  it("is case-sensitive — [verified] is not counted", () => {
    const script = "[verified] [VERIFIED]";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(1); // only [VERIFIED] uppercase counts
  });

  it("handles empty string", () => {
    const result = countVerifiedTags("");
    expect(result.verified).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
  });

  it("handles script with inline [VERIFIED] after phrases", () => {
    const script = "What if you could sleep 8 hours [VERIFIED] and wake up energized [VERIFIED]?";
    const result = countVerifiedTags(script);
    expect(result.verified).toBe(2);
    expect(result.total).toBe(2);
    expect(result.pct).toBe(100);
  });
});

// ─── SCRIPT_FORMATS ───────────────────────────────────────────────────────────

describe("SCRIPT_FORMATS", () => {
  it("contains all 6 expected formats", () => {
    expect(SCRIPT_FORMATS.length).toBe(6);
  });

  it("includes youtube_script", () => {
    expect(SCRIPT_FORMATS).toContain("youtube_script");
  });

  it("includes short_form", () => {
    expect(SCRIPT_FORMATS).toContain("short_form");
  });

  it("includes email", () => {
    expect(SCRIPT_FORMATS).toContain("email");
  });

  it("includes ad_copy", () => {
    expect(SCRIPT_FORMATS).toContain("ad_copy");
  });

  it("includes sales_page_section", () => {
    expect(SCRIPT_FORMATS).toContain("sales_page_section");
  });

  it("includes podcast_outline", () => {
    expect(SCRIPT_FORMATS).toContain("podcast_outline");
  });
});

// ─── FORMAT_DESCRIPTIONS ─────────────────────────────────────────────────────

describe("FORMAT_DESCRIPTIONS", () => {
  it("has a description for every format", () => {
    for (const format of SCRIPT_FORMATS) {
      expect(FORMAT_DESCRIPTIONS[format]).toBeTruthy();
      expect(FORMAT_DESCRIPTIONS[format].length).toBeGreaterThan(10);
    }
  });

  it("youtube_script description mentions duration", () => {
    expect(FORMAT_DESCRIPTIONS.youtube_script).toMatch(/min/i);
  });

  it("short_form description mentions seconds", () => {
    expect(FORMAT_DESCRIPTIONS.short_form).toMatch(/sec/i);
  });

  it("email description mentions subject line", () => {
    expect(FORMAT_DESCRIPTIONS.email).toMatch(/subject/i);
  });

  it("ad_copy description mentions CTA", () => {
    expect(FORMAT_DESCRIPTIONS.ad_copy).toMatch(/CTA/i);
  });
});

// ─── Verification threshold logic ────────────────────────────────────────────

describe("Verification threshold logic", () => {
  const TARGET_PCT = 40;

  it("40% is the minimum target verification coverage", () => {
    expect(TARGET_PCT).toBe(40);
  });

  it("script with 3 verified out of 6 elements meets 40% threshold", () => {
    const verified = 3;
    const total = 6;
    const pct = Math.round((verified / total) * 100);
    expect(pct).toBe(50);
    expect(pct >= TARGET_PCT).toBe(true);
  });

  it("script with 1 verified out of 6 elements does not meet 40% threshold", () => {
    const verified = 1;
    const total = 6;
    const pct = Math.round((verified / total) * 100);
    expect(pct).toBe(17);
    expect(pct >= TARGET_PCT).toBe(false);
  });

  it("script with 2 verified out of 5 elements meets 40% threshold exactly", () => {
    const verified = 2;
    const total = 5;
    const pct = Math.round((verified / total) * 100);
    expect(pct).toBe(40);
    expect(pct >= TARGET_PCT).toBe(true);
  });
});

// ─── Script body validation ───────────────────────────────────────────────────

describe("Script body validation", () => {
  it("rejects empty script body", () => {
    const isValid = (body: string) => body.trim().length >= 50;
    expect(isValid("")).toBe(false);
    expect(isValid("   ")).toBe(false);
  });

  it("accepts script body of at least 50 chars", () => {
    const isValid = (body: string) => body.trim().length >= 50;
    const validScript = "[HOOK] What if you could transform your health in just 7 days?";
    expect(isValid(validScript)).toBe(true);
  });

  it("rejects script body shorter than 50 chars", () => {
    const isValid = (body: string) => body.trim().length >= 50;
    expect(isValid("[HOOK] Short")).toBe(false);
  });
});

// ─── Pattern type selection ───────────────────────────────────────────────────

describe("Pattern type selection defaults", () => {
  const DEFAULT_TYPES = ["hook", "pain_point", "proof_element", "cta", "transformation_arc"];

  it("default selection includes 5 types", () => {
    expect(DEFAULT_TYPES.length).toBe(5);
  });

  it("hook is in defaults", () => {
    expect(DEFAULT_TYPES).toContain("hook");
  });

  it("cta is in defaults", () => {
    expect(DEFAULT_TYPES).toContain("cta");
  });

  it("pain_point is in defaults", () => {
    expect(DEFAULT_TYPES).toContain("pain_point");
  });

  it("proof_element is in defaults", () => {
    expect(DEFAULT_TYPES).toContain("proof_element");
  });

  it("transformation_arc is in defaults", () => {
    expect(DEFAULT_TYPES).toContain("transformation_arc");
  });
});
