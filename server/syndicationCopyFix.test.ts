/**
 * Syndication Copy Fix — Vitest tests
 *
 * Tests the markdownToPlainText utility that is used in VADashboard
 * to strip Markdown syntax before pasting into Quora's plain-text editor
 * and as an alternative copy option for Medium.
 *
 * The function is defined in the client (VADashboard.tsx) but we test
 * the logic here as a pure function to verify correctness.
 */
import { describe, it, expect } from "vitest";

// ── Pure function extracted from VADashboard.tsx for testing ──────────────────
function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

describe("markdownToPlainText", () => {
  it("strips ATX headings", () => {
    const md = "## Introduction\n\nSome text here.";
    const result = markdownToPlainText(md);
    expect(result).not.toContain("##");
    expect(result).toContain("Introduction");
    expect(result).toContain("Some text here.");
  });

  it("strips bold syntax", () => {
    const md = "This is **very important** information.";
    const result = markdownToPlainText(md);
    expect(result).toBe("This is very important information.");
  });

  it("strips italic syntax", () => {
    const md = "This is *emphasized* text.";
    const result = markdownToPlainText(md);
    expect(result).toBe("This is emphasized text.");
  });

  it("strips inline code", () => {
    const md = "Use the `gut-brain axis` term.";
    const result = markdownToPlainText(md);
    expect(result).toBe("Use the gut-brain axis term.");
  });

  it("converts links to just the link text", () => {
    const md = "Read more at [The Urban Monk](https://theurbanmonk.com).";
    const result = markdownToPlainText(md);
    expect(result).toBe("Read more at The Urban Monk.");
    expect(result).not.toContain("https://");
  });

  it("removes horizontal rules", () => {
    const md = "Section one.\n\n---\n\nSection two.";
    const result = markdownToPlainText(md);
    expect(result).not.toContain("---");
    expect(result).toContain("Section one.");
    expect(result).toContain("Section two.");
  });

  it("collapses excessive blank lines", () => {
    const md = "Para one.\n\n\n\n\nPara two.";
    const result = markdownToPlainText(md);
    expect(result).toBe("Para one.\n\nPara two.");
  });

  it("handles a realistic Quora answer with mixed Markdown", () => {
    const md = `## Why Am I Always Tired?

**Fatigue** is one of the most common complaints I hear in my clinic. After 20 years of practice, I've identified three root causes:

1. **Mitochondrial dysfunction** — your cells aren't producing energy efficiently
2. *Cortisol dysregulation* — chronic stress depletes your adrenal reserves
3. Poor sleep architecture — you're not getting enough \`deep sleep\`

Read the full breakdown at [The Urban Monk](https://theurbanmonk.com/fatigue).`;

    const result = markdownToPlainText(md);

    // Should not contain any Markdown syntax
    expect(result).not.toContain("##");
    expect(result).not.toContain("**");
    expect(result).not.toContain("*");
    expect(result).not.toContain("`");
    expect(result).not.toContain("[");
    expect(result).not.toContain("](");

    // Should preserve the actual content
    expect(result).toContain("Why Am I Always Tired?");
    expect(result).toContain("Fatigue");
    expect(result).toContain("Mitochondrial dysfunction");
    expect(result).toContain("Cortisol dysregulation");
    expect(result).toContain("deep sleep");
    expect(result).toContain("The Urban Monk");
    // URL should be removed
    expect(result).not.toContain("https://");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToPlainText("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    const plain = "This is already plain text with no formatting.";
    expect(markdownToPlainText(plain)).toBe(plain);
  });
});
