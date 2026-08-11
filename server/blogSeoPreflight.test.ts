import { describe, expect, it } from "vitest";
import { auditBlogSeo, toHeadlineCase } from "./blogSeoPreflight";

describe("blog SEO preflight", () => {
  it("flags the same title and keyword-density failures found in the supplied draft", () => {
    const audit = auditBlogSeo({
      article: "How to heal leaky gut naturally starts with understanding the topic.\n\n## How to heal leaky gut naturally\n\nMore context.",
      focusKeyword: "how to heal leaky gut naturally",
      seoTitle: "A Comprehensive Guide to Gut Health and Digestive Wellness",
      metaDescription: "Too short.",
    });

    expect(audit.keywordOccurrences).toBe(2);
    expect(audit.issues).toContain("Focus keyword appears 2 times; require at least 8 natural mentions.");
    expect(audit.issues).toContain("SEO title must start with the focus keyword.");
    expect(audit.issues).toContain("SEO title must be 1–48 characters.");
  });

  it("keeps small words lowercased while normalizing title capitalization", () => {
    expect(toHeadlineCase("how to heal leaky gut naturally")).toBe("How to Heal Leaky Gut Naturally");
  });
});
