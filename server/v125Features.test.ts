/**
 * v125 Feature Tests
 * - blog.regenerateBanner procedure contract
 * - Key Takeaways regex extraction (used in CommandCenter UI)
 * - WordPress CTA banner sync: ctaBannerUrl field on WpPostInput
 */
import { describe, it, expect } from "vitest";

// ─── Key Takeaways regex (mirrors CommandCenter.tsx logic) ───────────────────
function extractKeyTakeaways(content: string): string {
  const ktMatch = content.match(/##\s*Key Takeaways\s*\n([\s\S]*?)(?=\n##\s|$)/);
  return ktMatch ? ktMatch[1].trim() : "";
}

function replaceKeyTakeaways(content: string, newKt: string): string {
  return content.replace(
    /##\s*Key Takeaways\s*\n[\s\S]*?(?=\n##\s|$)/,
    `## Key Takeaways\n${newKt}\n\n`
  );
}

describe("Key Takeaways extraction", () => {
  it("extracts bullet points from ## Key Takeaways section", () => {
    const article = `## Introduction\nSome intro text.\n\n## Key Takeaways\n- Point one\n- Point two\n- Point three\n\n## Section 2\nMore content.`;
    const kt = extractKeyTakeaways(article);
    expect(kt).toBe("- Point one\n- Point two\n- Point three");
  });

  it("returns empty string when Key Takeaways section is absent", () => {
    const article = `## Introduction\nNo takeaways here.\n\n## Conclusion\nDone.`;
    expect(extractKeyTakeaways(article)).toBe("");
  });

  it("handles Key Takeaways at end of document (no following ##)", () => {
    const article = `## Introduction\nText.\n\n## Key Takeaways\n- Only point`;
    expect(extractKeyTakeaways(article)).toBe("- Only point");
  });

  it("replaces Key Takeaways block correctly without corrupting surrounding sections", () => {
    const article = `## Introduction\nText.\n\n## Key Takeaways\n- Old point\n\n## Section 2\nMore.`;
    const updated = replaceKeyTakeaways(article, "- New point A\n- New point B");
    expect(updated).toContain("- New point A");
    expect(updated).toContain("- New point B");
    expect(updated).not.toContain("- Old point");
    expect(updated).toContain("## Section 2");
  });
});

// ─── WpPostInput ctaBannerUrl field ──────────────────────────────────────────
import type { WpPostInput } from "./wordpress";

describe("WpPostInput ctaBannerUrl field", () => {
  it("accepts ctaBannerUrl as an optional string", () => {
    const input: WpPostInput = {
      title: "Test Post",
      slug: "test-post",
      content: "<p>Hello</p>",
      ctaBannerUrl: "https://cdn.example.com/banner.jpg",
    };
    expect(input.ctaBannerUrl).toBe("https://cdn.example.com/banner.jpg");
  });

  it("allows ctaBannerUrl to be omitted", () => {
    const input: WpPostInput = {
      title: "Test Post",
      slug: "test-post",
      content: "<p>Hello</p>",
    };
    expect(input.ctaBannerUrl).toBeUndefined();
  });
});

// ─── CTA banner block regex (used in regenerateBanner) ───────────────────────
describe("CTA banner block replacement regex", () => {
  it("removes existing um-cta-banner div from article body", () => {
    // The banner block has an outer div.um-cta-banner containing an inner <a> with nested divs.
    // The regex targets the outer div by matching up to the closing </div> of the outer wrapper.
    // We test the regex used in regenerateBanner which targets the outer div.
    const bannerBlock = `<div class="um-cta-banner" style="margin:2.5rem 0;text-align:center;">\n  <a href="https://example.com" style="display:inline-block;">\n    <img src="https://old-banner.jpg" />\n    <div style="margin-top:0.75rem;">CTA text</div>\n  </a>\n</div>`;
    const articleWithBanner = `Some content.\n\n${bannerBlock}\n\n## FAQ`;
    // Regex that matches the full outer div including nested content
    const cleaned = articleWithBanner.replace(/<div class="um-cta-banner"[\s\S]*?<\/a>\s*\n<\/div>/g, "");
    expect(cleaned).not.toContain("um-cta-banner");
    expect(cleaned).toContain("## FAQ");
  });

  it("injects new banner before FAQ section", () => {
    const article = `Content.\n\n## Frequently Asked Questions\nQ: What?`;
    const bannerBlock = `\n\n<div class="um-cta-banner">NEW BANNER</div>`;
    const faqMatch = article.match(/\n##\s*(Frequently Asked Questions|FAQ)/i);
    let updated = article;
    if (faqMatch && faqMatch.index !== undefined) {
      updated = article.slice(0, faqMatch.index) + bannerBlock + article.slice(faqMatch.index);
    }
    const bannerIdx = updated.indexOf("NEW BANNER");
    const faqIdx = updated.indexOf("## Frequently Asked Questions");
    expect(bannerIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeLessThan(faqIdx);
  });
});
