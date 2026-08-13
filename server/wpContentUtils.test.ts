/**
 * Tests for wpContentUtils — WordPress content pipeline utilities.
 *
 * Covers:
 *  - extractAndConvertHashtags: hashtag detection and bold conversion
 *  - markdownToWpHtml: full markdown-to-HTML pipeline
 */

import { describe, it, expect } from "vitest";
import { deriveWpDraftFocusKeyword, ensureWpDraftLinks, ensureWpDraftMetaDescription, extractAndConvertHashtags, injectFeaturedImageIntoWpHtml, markdownToWpHtml } from "./wpContentUtils";

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

  it("converts Markdown AFTER an injected HTML block (CTA banner regression)", () => {
    // This is the exact bug: a <div> CTA banner is injected into the Markdown body
    // just before the FAQ section. Previously, marked would stop converting Markdown
    // after the HTML block, leaving the FAQ as raw ## / ### text.
    const ctaBanner = `<div class="um-cta-banner" style="margin:2.5rem 0;text-align:center;">\n  <a href="https://example.com">\n    <img src="https://cdn.example.com/banner.jpg" alt="CTA" />\n    <div style="color:#7c5c2e;">Transform your health today</div>\n  </a>\n</div>`;
    const md = [
      "## Why Sleep Matters",
      "",
      "Sleep is the foundation of health.",
      "",
      ctaBanner,
      "",
      "## Frequently Asked Questions",
      "",
      "### How much sleep do I need?",
      "",
      "Most adults need 7-9 hours of quality sleep per night.",
    ].join("\n");

    const html = markdownToWpHtml(md);

    // Article body before the banner must be converted
    expect(html).toContain("<h2>Why Sleep Matters</h2>");
    expect(html).toContain("<p>Sleep is the foundation of health.</p>");

    // The CTA banner HTML must pass through unchanged
    expect(html).toContain('class="um-cta-banner"');

    // CRITICAL: FAQ section AFTER the HTML block must also be converted
    expect(html).toContain("<h2>Frequently Asked Questions</h2>");
    expect(html).toContain("<h3>How much sleep do I need?</h3>");
    expect(html).toContain("<p>Most adults need 7-9 hours of quality sleep per night.</p>");

    // Must NOT contain raw Markdown syntax after the HTML block
    expect(html).not.toContain("## Frequently Asked Questions");
    expect(html).not.toContain("### How much sleep do I need?");
  });

  it("passes through a standalone HTML block without double-wrapping it", () => {
    const html = markdownToWpHtml('<div class="um-cta-banner"><a href="#">Click</a></div>');
    // Should not wrap the div in a <p> tag
    expect(html).toContain('<div class="um-cta-banner">');
    expect(html).not.toContain('<p><div');
  });
});

describe("injectFeaturedImageIntoWpHtml", () => {
  it("inserts a descriptive in-content hero image after the first paragraph", () => {
    const html = injectFeaturedImageIntoWpHtml({
      html: "<p>Opening context.</p><h2>Next section</h2>",
      imageUrl: "https://cdn.example.com/hero.jpg",
      altText: "Gut health and hormone detoxification",
      caption: "A contextual article image",
    });

    expect(html).toContain('data-um-in-content-hero');
    expect(html).toContain('alt="Gut health and hormone detoxification"');
    expect(html.indexOf("</p>")).toBeLessThan(html.indexOf("data-um-in-content-hero"));
    expect(html.indexOf("data-um-in-content-hero")).toBeLessThan(html.indexOf("<h2>"));
  });

  it("does not duplicate a generated article image", () => {
    const source = '<p>Opening.</p><img src="https://example.com/existing.jpg" alt="Existing" />';
    expect(injectFeaturedImageIntoWpHtml({
      html: source,
      imageUrl: "https://cdn.example.com/hero.jpg",
      altText: "New image",
    })).toBe(source);
  });
});

describe("ensureWpDraftLinks", () => {
  it("adds an internal resource and educational external link only when both are absent", () => {
    const html = ensureWpDraftLinks({ html: "<p>Article body.</p>", topic: "gut health" });
    expect(html).toContain('href="https://theurbanmonk.com/"');
    expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/?term=gut%20health"');
  });

  it("preserves existing internal and external links without duplicate fallback blocks", () => {
    const source = '<p><a href="https://theurbanmonk.com/gut-health/">Internal</a> and <a href="https://pubmed.ncbi.nlm.nih.gov/">External</a>.</p>';
    expect(ensureWpDraftLinks({ html: source, topic: "gut health" })).toBe(source);
  });
});

describe("WordPress draft metadata fallbacks", () => {
  it("derives a compact fallback focus phrase when metadata generation is unavailable", () => {
    expect(deriveWpDraftFocusKeyword("How Gut Health Shapes Better Sleep")).toBe("How Gut Health Shapes");
  });

  it("creates a non-empty bounded meta description when a publisher has none", () => {
    const description = ensureWpDraftMetaDescription({ metaDescription: "", topic: "gut health and sleep" });
    expect(description).toContain("gut health and sleep");
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(148);
  });
});
