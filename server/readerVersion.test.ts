/**
 * Tests for the "Create Version for Average Reader" feature.
 * Validates the prompt rules and the content extraction logic used in
 * blog.createReaderVersion (server/routers.ts).
 */
import { describe, it, expect } from "vitest";

// ── Inline copy of the content extraction logic ─────────────────────────────
// Mirrors the rawContent extraction in routers.ts createReaderVersion.
function extractRewrittenText(
  rawContent: string | Array<{ type: string; text?: string }> | undefined
): string {
  if (typeof rawContent === "string") return rawContent;
  if (Array.isArray(rawContent)) {
    return rawContent
      .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
      .join("");
  }
  return "";
}

// ── Helper: simulate what the prompt rules enforce ───────────────────────────
function citationsPreserved(original: string, rewritten: string): boolean {
  // Extract all citation markers from the original
  const citationRegex = /\[\^?\d+\]|\(\w[^)]+\d{4}[^)]*\)/g;
  const originalCitations = original.match(citationRegex) ?? [];
  if (originalCitations.length === 0) return true; // no citations to check
  return originalCitations.every((c) => rewritten.includes(c));
}

function noNewUrlsAdded(original: string, rewritten: string): boolean {
  const urlRegex = /https?:\/\/[^\s)>"]+/g;
  const originalUrls = new Set(original.match(urlRegex) ?? []);
  const rewrittenUrls = rewritten.match(urlRegex) ?? [];
  return rewrittenUrls.every((url) => originalUrls.has(url));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createReaderVersion — content extraction", () => {
  it("returns string content directly", () => {
    expect(extractRewrittenText("Hello world")).toBe("Hello world");
  });

  it("joins text parts from array content", () => {
    const parts = [
      { type: "text", text: "Part one. " },
      { type: "text", text: "Part two." },
    ];
    expect(extractRewrittenText(parts)).toBe("Part one. Part two.");
  });

  it("skips non-text parts in array content", () => {
    const parts = [
      { type: "text", text: "Text part." },
      { type: "image_url", url: "https://example.com/img.jpg" },
    ];
    expect(extractRewrittenText(parts)).toBe("Text part.");
  });

  it("returns empty string for undefined content", () => {
    expect(extractRewrittenText(undefined)).toBe("");
  });
});

describe("createReaderVersion — citation preservation rules", () => {
  it("detects preserved numeric citations", () => {
    const original = "Gut bacteria influence mood [1] and sleep quality [2].";
    const rewritten = "Your gut bugs affect how you feel [1] and how well you sleep [2].";
    expect(citationsPreserved(original, rewritten)).toBe(true);
  });

  it("detects missing citations in rewrite", () => {
    const original = "Studies show [1] that meditation reduces cortisol [2].";
    const rewritten = "Studies show that meditation reduces cortisol."; // [1] and [2] removed
    expect(citationsPreserved(original, rewritten)).toBe(false);
  });

  it("handles footnote-style citations [^1]", () => {
    const original = "The microbiome affects the brain [^1].";
    const rewritten = "Your gut talks to your brain [^1].";
    expect(citationsPreserved(original, rewritten)).toBe(true);
  });

  it("passes when original has no citations", () => {
    const original = "Meditation is good for you.";
    const rewritten = "Meditation is great for your health.";
    expect(citationsPreserved(original, rewritten)).toBe(true);
  });
});

describe("createReaderVersion — no hallucinated URL rule", () => {
  it("passes when rewrite uses only original URLs", () => {
    const original = "Learn more at https://theurbanmonk.com/sleep.";
    const rewritten = "Find out more at https://theurbanmonk.com/sleep.";
    expect(noNewUrlsAdded(original, rewritten)).toBe(true);
  });

  it("fails when rewrite adds a new URL", () => {
    const original = "Meditation helps. See https://theurbanmonk.com/meditation.";
    const rewritten =
      "Meditation helps. See https://theurbanmonk.com/meditation and https://newsite.com/extra.";
    expect(noNewUrlsAdded(original, rewritten)).toBe(false);
  });

  it("passes when rewrite removes a URL (conservative)", () => {
    const original = "Visit https://theurbanmonk.com/sleep for more.";
    const rewritten = "Visit the Academy for more."; // URL removed — allowed by rule 4 (preserve, not require)
    expect(noNewUrlsAdded(original, rewritten)).toBe(true);
  });
});
