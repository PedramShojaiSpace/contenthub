/**
 * Tests for v124 blog enhancements:
 * 1. Key Takeaways section is expected in the BLOG_PROMPT structure
 * 2. CTA banner HTML block injection logic (insert before FAQ, or append)
 */
import { describe, it, expect } from "vitest";

// ── Helper: replicate the CTA banner injection logic from routers.ts ──────────
function injectCtaBanner(articleBody: string, ctaBannerBlock: string): string {
  const faqMatch = articleBody.match(/\n##\s*(Frequently Asked Questions|FAQ)/i);
  if (faqMatch && faqMatch.index !== undefined) {
    return (
      articleBody.slice(0, faqMatch.index) +
      ctaBannerBlock +
      articleBody.slice(faqMatch.index)
    );
  }
  return articleBody + ctaBannerBlock;
}

const SAMPLE_BANNER = `\n\n<div class="um-cta-banner"><a href="https://lightson.theurbanmonk.com/"><img src="https://cdn.example.com/banner.jpg" /></a></div>`;

describe("Blog CTA Banner Injection", () => {
  it("inserts the banner block immediately before the FAQ section when present", () => {
    const article = `Opening hook paragraph.\n\n## The Hidden Problem\n\nBody text.\n\n## Frequently Asked Questions\n\n**Q: What is this?**\n\nA: This is a test.`;
    const result = injectCtaBanner(article, SAMPLE_BANNER);
    const faqIdx = result.indexOf("## Frequently Asked Questions");
    const bannerIdx = result.indexOf("um-cta-banner");
    expect(bannerIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeLessThan(faqIdx);
  });

  it("appends the banner block at the end when no FAQ section is present", () => {
    const article = `Opening hook paragraph.\n\n## The Hidden Problem\n\nBody text.\n\n## Closing\n\nFinal paragraph.`;
    const result = injectCtaBanner(article, SAMPLE_BANNER);
    expect(result.endsWith(SAMPLE_BANNER)).toBe(true);
  });

  it("also works with 'FAQ' heading variant", () => {
    const article = `Intro.\n\n## FAQ\n\nQ: How?\nA: Like this.`;
    const result = injectCtaBanner(article, SAMPLE_BANNER);
    const faqIdx = result.indexOf("## FAQ");
    const bannerIdx = result.indexOf("um-cta-banner");
    expect(bannerIdx).toBeLessThan(faqIdx);
  });

  it("preserves article content around the injection point", () => {
    const article = `Before FAQ.\n\n## Frequently Asked Questions\n\nAfter FAQ.`;
    const result = injectCtaBanner(article, SAMPLE_BANNER);
    expect(result).toContain("Before FAQ.");
    expect(result).toContain("After FAQ.");
    expect(result).toContain("um-cta-banner");
  });
});

describe("Key Takeaways section in BLOG_PROMPT", () => {
  it("BLOG_PROMPT structure includes the Key Takeaways section directive", async () => {
    // Dynamically import the compiled routers module to check the prompt string
    // We verify the prompt contains the Key Takeaways instruction
    const fs = await import("fs");
    const path = await import("path");
    const routersPath = path.resolve(process.cwd(), "server/routers.ts");
    const source = fs.readFileSync(routersPath, "utf-8");
    expect(source).toContain("KEY TAKEAWAYS");
    expect(source).toContain("## Key Takeaways");
    expect(source).toContain("4-6 concise bullet points");
  });
});
