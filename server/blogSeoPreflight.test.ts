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

  it("requires two keyword headings, safe snippet length, and adequate transition coverage", () => {
    const keyword = "how to heal leaky gut naturally";
    const article = [
      "How to heal leaky gut naturally begins with a careful look at your individual symptoms and care plan.",
      "## How to Heal Leaky Gut Naturally: Foundations",
      "First, identify patterns that may be worth discussing with a qualified clinician. Therefore, focus on steady, sustainable habits rather than a quick fix.",
      "## How to Heal Leaky Gut Naturally: Daily Habits",
      "In addition, support sleep, stress regulation, and meals you tolerate well. Consequently, the approach can remain practical over time.",
      `${keyword} is not a one-supplement answer. For many people, ${keyword} requires patience.`,
      `A thoughtful approach to ${keyword} includes context. Ultimately, ${keyword} is a question of overall digestive health.`,
      `In practice, ${keyword} should be individualized. Still, ${keyword} can guide a useful conversation.`,
      `Finally, ${keyword} benefits from consistency.`,
    ].join("\n\n");
    const audit = auditBlogSeo({
      article,
      focusKeyword: keyword,
      seoTitle: "How to Heal Leaky Gut Naturally",
      metaDescription: "Learn how to heal leaky gut naturally with practical guidance on food triggers, stress, nutrition, and gut-supporting daily habits.",
    });

    expect(audit.keywordSubheadingCount).toBe(2);
    expect(audit.transitionWordRate).toBeGreaterThanOrEqual(32);
    expect(audit.metaDescriptionLength).toBeGreaterThanOrEqual(120);
    expect(audit.metaDescriptionLength).toBeLessThanOrEqual(135);
    expect(audit.issues).toHaveLength(0);
  });
});
