/**
 * Tests for wpContentUtils — WordPress content pipeline utilities.
 *
 * Covers:
 *  - extractAndConvertHashtags: hashtag detection and bold conversion
 *  - markdownToWpHtml: full markdown-to-HTML pipeline
 */

import { describe, it, expect } from "vitest";
import { extractAndConvertHashtags, markdownToWpHtml } from "./wpContentUtils";

// ─── extractAndConvertHashtags ────────────────────────────────────────────────

describe("extractAndConvertHashtags", () => {
  it("extracts a single trailing hashtag line and converts to bold", () => {
    const input = "This is the article body.\n\n#urbanmonk #guthealth #energy";
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags(input);
    expect(cleanBody).toBe("This is the article body.");
    expect(hashtagHtml).toContain("<strong>#urbanmonk</strong>");
    expect(hashtagHtml).toContain("<strong>#guthealth</strong>");
    expect(hashtagHtml).toContain("<strong>#energy</strong>");
    expect(hashtagHtml).toContain("blog-hashtags");
  });

  it("returns empty hashtagHtml when no hashtags are present", () => {
    const input = "This is a clean article with no hashtags at the end.";
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags(input);
    expect(cleanBody).toBe(input);
    expect(hashtagHtml).toBe("");
  });

  it("handles multiple hashtag lines at the end", () => {
    const input = "Body text here.\n\n#urbanmonk\n#guthealth";
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags(input);
    expect(cleanBody).toBe("Body text here.");
    expect(hashtagHtml).toContain("<strong>#urbanmonk</strong>");
    expect(hashtagHtml).toContain("<strong>#guthealth</strong>");
  });

  it("does NOT extract hashtags that appear mid-body (only trailing)", () => {
    const input = "Use #guthealth practices daily.\n\nThis is the last paragraph without hashtags.";
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags(input);
    expect(cleanBody).toBe(input);
    expect(hashtagHtml).toBe("");
  });

  it("handles trailing blank lines before the hashtag block", () => {
    const input = "Article body.\n\n\n\n#urbanmonk #health";
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags(input);
    expect(cleanBody).toBe("Article body.");
    expect(hashtagHtml).toContain("<strong>#urbanmonk</strong>");
  });

  it("handles empty input gracefully", () => {
    const { cleanBody, hashtagHtml } = extractAndConvertHashtags("");
    expect(cleanBody).toBe("");
    expect(hashtagHtml).toBe("");
  });
});

// ─── markdownToWpHtml ─────────────────────────────────────────────────────────

describe("markdownToWpHtml", () => {
  it("converts ## headings to <h2> tags", () => {
    const md = "## Why Gut Health Matters\n\nSome paragraph text.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<h2>Why Gut Health Matters</h2>");
    expect(html).toContain("<p>Some paragraph text.</p>");
  });

  it("converts **bold** to <strong> tags", () => {
    const md = "This is **very important** to understand.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<strong>very important</strong>");
  });

  it("converts blockquotes to <blockquote> tags", () => {
    const md = "> Your body keeps the score.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<blockquote>");
  });

  it("moves trailing hashtags to a bold paragraph at the bottom", () => {
    const md = "## Article\n\nBody content here.\n\n#urbanmonk #guthealth";
    const html = markdownToWpHtml(md);
    // Hashtags should NOT appear as an H1 (# would be parsed as heading)
    expect(html).not.toContain("<h1>urbanmonk");
    // Hashtags should appear as bold in a paragraph
    expect(html).toContain("<strong>#urbanmonk</strong>");
    expect(html).toContain("<strong>#guthealth</strong>");
    expect(html).toContain("blog-hashtags");
    // Article body should still be present
    expect(html).toContain("Body content here.");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToWpHtml("")).toBe("");
    expect(markdownToWpHtml("   ")).toBe("");
  });

  it("converts links to <a> tags", () => {
    const md = "Read more at [The Urban Monk](https://theurbanmonk.com).";
    const html = markdownToWpHtml(md);
    expect(html).toContain('<a href="https://theurbanmonk.com">The Urban Monk</a>');
  });
});
