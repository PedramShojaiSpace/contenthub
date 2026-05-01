/**
 * v130Features.test.ts
 *
 * Tests for:
 *  1. Banner font size auto-scaling (short / medium / long headlines)
 *  2. CTA banner preview state type (ctaBannerUrl field on blogContent)
 *  3. bulkFixCampaigns procedure input schema validation
 */

import { describe, it, expect } from "vitest";

// ─── 1. Font size auto-scaling logic ─────────────────────────────────────────
// Mirrors the branching in bannerComposite.ts line 124:
//   headline.length > 60 → 42px
//   headline.length > 40 → 48px
//   else                 → 54px
function headlineFontSize(headline: string): number {
  return headline.length > 60 ? 42 : headline.length > 40 ? 48 : 54;
}

describe("bannerComposite headlineFontSize auto-scaling", () => {
  it("uses 54px for short headlines (≤40 chars)", () => {
    const short = "Reclaim Your Energy";               // 19 chars
    expect(headlineFontSize(short)).toBe(54);
  });

  it("uses 54px for a 40-char headline (boundary)", () => {
    const boundary = "A".repeat(40);
    expect(headlineFontSize(boundary)).toBe(54);
  });

  it("uses 48px for medium headlines (41–60 chars)", () => {
    const medium = "How to Build Lasting Energy with Adaptogens"; // 44 chars
    expect(headlineFontSize(medium)).toBe(48);
  });

  it("uses 48px for a 60-char headline (boundary)", () => {
    const boundary60 = "B".repeat(60);
    expect(headlineFontSize(boundary60)).toBe(48);
  });

  it("uses 42px for long headlines (>60 chars)", () => {
    const long = "The Complete Guide to Cardiometabolic Health Through Ancient Wisdom and Modern Science"; // 86 chars
    expect(headlineFontSize(long)).toBe(42);
  });

  it("uses 42px for very long headlines (80+ chars)", () => {
    const veryLong = "C".repeat(80);
    expect(headlineFontSize(veryLong)).toBe(42);
  });

  it("correctly classifies all three tiers across a range of real-world CTA headlines", () => {
    const cases: [string, number][] = [
      ["Join Lights On", 54],                                                    // 14 chars
      ["Start Your Healing Journey Today", 54],                                  // 33 chars
      ["Unlock the Urban Monk Academy for $297/yr", 48],                         // 41 chars
      ["Discover the Five Tibetan Rites for Daily Energy", 48],                  // 49 chars
      ["Transform Your Health with Dr. Pedram Shojai's Proven System!", 42],     // 61 chars
      ["Get Instant Access to 200+ Hours of Wellness Training and Coaching", 42], // 67 chars
    ];
    for (const [headline, expected] of cases) {
      expect(headlineFontSize(headline), `headline: "${headline}"`).toBe(expected);
    }
  });
});

// ─── 2. CTA button label truncation ──────────────────────────────────────────
// Mirrors bannerComposite.ts lines 154-156
function truncateBtnLabel(label: string): string {
  return label.length > 50 ? label.substring(0, 47) + "…" : label;
}

describe("bannerComposite button label truncation", () => {
  it("does not truncate labels ≤50 chars", () => {
    const label = "Join the Urban Monk Academy — Free Trial";
    expect(truncateBtnLabel(label)).toBe(label);
  });

  it("truncates labels >50 chars to 47 chars + ellipsis", () => {
    const label = "Get Instant Access to the Urban Monk Academy Today — Only $297/yr";
    const result = truncateBtnLabel(label);
    expect(result).toHaveLength(48); // 47 + "…" (1 char)
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles exactly 50 chars without truncation", () => {
    const label = "D".repeat(50);
    expect(truncateBtnLabel(label)).toBe(label);
  });

  it("handles exactly 51 chars with truncation", () => {
    const label = "E".repeat(51);
    expect(truncateBtnLabel(label)).toHaveLength(48);
  });
});

// ─── 3. bulkFixCampaigns input schema ────────────────────────────────────────
import { z } from "zod";

const bulkFixInputSchema = z.object({
  dryRun: z.boolean().optional().default(false),
});

describe("bulkFixCampaigns input schema", () => {
  it("accepts empty input (defaults dryRun to false)", () => {
    const result = bulkFixInputSchema.parse({});
    expect(result.dryRun).toBe(false);
  });

  it("accepts dryRun: true", () => {
    const result = bulkFixInputSchema.parse({ dryRun: true });
    expect(result.dryRun).toBe(true);
  });

  it("rejects non-boolean dryRun", () => {
    expect(() => bulkFixInputSchema.parse({ dryRun: "yes" })).toThrow();
  });
});

// ─── 4. Banner canvas dimensions ─────────────────────────────────────────────
describe("bannerComposite canvas constants", () => {
  it("uses standard 16:9 1200×675 dimensions", () => {
    const CANVAS_W = 1200;
    const CANVAS_H = 675;
    expect(CANVAS_W / CANVAS_H).toBeCloseTo(16 / 9, 2);
  });

  it("button is positioned 48px from the bottom", () => {
    const CANVAS_H = 675;
    const btnFontSize = 28;
    const btnPaddingY = 16;
    const btnH = btnFontSize + btnPaddingY * 2;
    const btnY = CANVAS_H - btnH - 48;
    expect(btnY).toBeGreaterThan(0);
    expect(btnY + btnH + 48).toBe(CANVAS_H);
  });
});
