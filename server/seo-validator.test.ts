/**
 * Tests for the pre-publish SEO validator (blog.validateSeo) and
 * the H2 keyphrase auto-fix logic baked into blog.publish (Step 2c).
 *
 * The validateSeo procedure is a DB-backed query, so we test the
 * underlying scoring logic directly via unit-level helpers extracted
 * from the same rules used in routers.ts.
 */

import { describe, expect, it } from "vitest";

// ─── Inline scoring helpers (mirrors routers.ts validateSeo logic) ────────────
type SeoStatus = "green" | "amber" | "red";

function scoreSeoTitle(seoTitle: string): SeoStatus {
  const len = seoTitle.length;
  return len <= 60 ? "green" : len <= 70 ? "amber" : "red";
}

function scoreMetaDesc(metaDesc: string): SeoStatus {
  if (!metaDesc) return "red";
  const len = metaDesc.length;
  if (len >= 140 && len <= 155) return "green";
  if (len >= 120 && len <= 160) return "amber";
  return "red";
}

function scoreKeyphraseDensity(body: string, focusKw: string): SeoStatus {
  if (!focusKw) return "red";
  const kwLower = focusKw.toLowerCase();
  const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const occurrences = (body.toLowerCase().match(new RegExp(escaped, "g")) ?? []).length;
  return occurrences >= 8 ? "green" : occurrences >= 3 ? "amber" : "red";
}

function scoreKeyphraseInH2(body: string, focusKw: string): SeoStatus {
  if (!focusKw) return "red";
  const kwLower = focusKw.toLowerCase();
  const h2Lines = body.split("\n").filter((l) => l.startsWith("## "));
  return h2Lines.some((l) => l.toLowerCase().includes(kwLower)) ? "green" : "red";
}

// ─── H2 keyphrase auto-fix helper (mirrors routers.ts Step 2c) ───────────────
function fixH2Keyphrase(body: string, focusKeyword: string): string {
  const kw = focusKeyword.toLowerCase();
  const h2Regex = /^## .+$/gm;
  const h2Matches = Array.from(body.matchAll(h2Regex));
  const keyphraseInH2 = h2Matches.some((m) => m[0].toLowerCase().includes(kw));
  if (keyphraseInH2 || h2Matches.length < 2) return body;

  const targetIndex = h2Matches.length >= 3 ? 2 : 1;
  const targetMatch = h2Matches[targetIndex];
  const originalH2 = targetMatch[0];
  const headingText = originalH2.replace(/^## /, "").trim();
  const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
  const newHeading = `## ${kwCapitalised}: ${headingText}`;
  const finalHeading = newHeading.length <= 80 ? newHeading : `## How ${kwCapitalised} ${headingText}`;
  const escapedOriginal = originalH2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(escapedOriginal, "m"), finalHeading);
}

// ─── SEO Title scoring ────────────────────────────────────────────────────────
describe("scoreSeoTitle", () => {
  it("returns green for titles ≤60 chars", () => {
    expect(scoreSeoTitle("GI Map Test Results | The Urban Monk")).toBe("green");
    expect(scoreSeoTitle("A".repeat(60))).toBe("green");
  });

  it("returns amber for titles 61-70 chars", () => {
    expect(scoreSeoTitle("A".repeat(61))).toBe("amber");
    expect(scoreSeoTitle("A".repeat(70))).toBe("amber");
  });

  it("returns red for titles over 70 chars", () => {
    expect(scoreSeoTitle("A".repeat(71))).toBe("red");
    expect(scoreSeoTitle("A".repeat(100))).toBe("red");
  });
});

// ─── Meta description scoring ─────────────────────────────────────────────────
describe("scoreMetaDesc", () => {
  it("returns green for 140-155 chars", () => {
    expect(scoreMetaDesc("A".repeat(140))).toBe("green");
    expect(scoreMetaDesc("A".repeat(155))).toBe("green");
  });

  it("returns amber for 120-139 or 156-160 chars", () => {
    expect(scoreMetaDesc("A".repeat(120))).toBe("amber");
    expect(scoreMetaDesc("A".repeat(139))).toBe("amber");
    expect(scoreMetaDesc("A".repeat(156))).toBe("amber");
    expect(scoreMetaDesc("A".repeat(160))).toBe("amber");
  });

  it("returns red for empty, <120, or >160 chars", () => {
    expect(scoreMetaDesc("")).toBe("red");
    expect(scoreMetaDesc("A".repeat(119))).toBe("red");
    expect(scoreMetaDesc("A".repeat(161))).toBe("red");
  });
});

// ─── Keyphrase density scoring ────────────────────────────────────────────────
describe("scoreKeyphraseDensity", () => {
  const makeBody = (kw: string, times: number) =>
    Array(times).fill(`This is about ${kw} and more content here.`).join("\n");

  it("returns green when keyphrase appears 8+ times", () => {
    expect(scoreKeyphraseDensity(makeBody("gut health", 8), "gut health")).toBe("green");
    expect(scoreKeyphraseDensity(makeBody("gut health", 12), "gut health")).toBe("green");
  });

  it("returns amber when keyphrase appears 3-7 times", () => {
    expect(scoreKeyphraseDensity(makeBody("gut health", 3), "gut health")).toBe("amber");
    expect(scoreKeyphraseDensity(makeBody("gut health", 7), "gut health")).toBe("amber");
  });

  it("returns red when keyphrase appears 0-2 times", () => {
    expect(scoreKeyphraseDensity("No keywords here at all.", "gut health")).toBe("red");
    expect(scoreKeyphraseDensity(makeBody("gut health", 2), "gut health")).toBe("red");
  });

  it("returns red when no focus keyphrase is set", () => {
    expect(scoreKeyphraseDensity("Some body text", "")).toBe("red");
  });
});

// ─── Keyphrase in H2 scoring ──────────────────────────────────────────────────
describe("scoreKeyphraseInH2", () => {
  it("returns green when keyphrase is in at least one H2", () => {
    const body = `## Introduction\n\n## GI Map Test Results: What They Mean\n\n## Conclusion`;
    expect(scoreKeyphraseInH2(body, "GI Map test results")).toBe("green");
  });

  it("is case-insensitive for the keyphrase match", () => {
    const body = `## Introduction\n\n## gi map test results explained\n\n## Conclusion`;
    expect(scoreKeyphraseInH2(body, "GI Map test results")).toBe("green");
  });

  it("returns red when no H2 contains the keyphrase", () => {
    const body = `## Introduction\n\n## Understanding Your Gut\n\n## Next Steps`;
    expect(scoreKeyphraseInH2(body, "GI Map test results")).toBe("red");
  });

  it("returns red when no focus keyphrase is set", () => {
    const body = `## Introduction\n\n## Some Heading`;
    expect(scoreKeyphraseInH2(body, "")).toBe("red");
  });
});

// ─── H2 keyphrase auto-fix ────────────────────────────────────────────────────
describe("fixH2Keyphrase", () => {
  const body = [
    "## The Hidden Problem Nobody Talks About",
    "",
    "Some intro content.",
    "",
    "## Why Most People Get This Wrong",
    "",
    "More content here.",
    "",
    "## The Three-Step Protocol",
    "",
    "Protocol content.",
  ].join("\n");

  it("injects the keyphrase into the 3rd H2 when none contain it", () => {
    const result = fixH2Keyphrase(body, "gut health");
    expect(result).toContain("## Gut health: The Three-Step Protocol");
    expect(result).not.toContain("## The Three-Step Protocol\n");
  });

  it("does not modify the body when the keyphrase is already in an H2", () => {
    const bodyWithKw = body.replace(
      "## The Hidden Problem Nobody Talks About",
      "## Gut Health: The Hidden Problem Nobody Talks About"
    );
    const result = fixH2Keyphrase(bodyWithKw, "gut health");
    expect(result).toBe(bodyWithKw);
  });

  it("falls back to the 2nd H2 when there are only 2 H2s", () => {
    const twoH2Body = [
      "## Introduction Section",
      "",
      "Content.",
      "",
      "## The Protocol Section",
      "",
      "More content.",
    ].join("\n");
    const result = fixH2Keyphrase(twoH2Body, "gut health");
    expect(result).toContain("## Gut health: The Protocol Section");
  });

  it("does not modify the body when there is only 1 H2", () => {
    const oneH2Body = "## Introduction\n\nContent here.";
    const result = fixH2Keyphrase(oneH2Body, "gut health");
    expect(result).toBe(oneH2Body);
  });

  it("truncates to the fallback format when the new heading would exceed 80 chars", () => {
    const longBody = [
      "## Short",
      "",
      "Content.",
      "",
      "## A Very Long Heading That Would Make The Combined Title Way Too Long For Yoast",
      "",
      "More content.",
    ].join("\n");
    const result = fixH2Keyphrase(longBody, "gut health");
    // The combined heading "## Gut health: A Very Long Heading..." is >80 chars
    // so it should fall back to "## How Gut health A Very Long Heading..."
    expect(result).toContain("## How Gut health");
  });
});
