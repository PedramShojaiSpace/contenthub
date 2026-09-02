import { describe, expect, it } from "vitest";
import { evaluateWpHandoffVerification, type WpHandoffExpectation } from "./wordpress";

const expectation: WpHandoffExpectation = {
  postId: 77,
  status: "draft",
  title: "A Verified Gut Health Article",
  slug: "verified-gut-health-article",
  featuredMediaId: 88,
  categoryId: 721,
  seoTitle: "A Verified Gut Health Article",
  metaDescription: "A precise, review-ready description of the article for search results and social previews.",
  focusKeyword: "gut microbiome health",
  canonicalUrl: "https://theurbanmonk.com/verified-gut-health-article/",
};

const matchingRecord = {
  status: "draft",
  slug: expectation.slug,
  title: { raw: expectation.title },
  featured_media: expectation.featuredMediaId,
  categories: [expectation.categoryId],
  meta: {
    _yoast_wpseo_title: expectation.seoTitle,
    _yoast_wpseo_metadesc: expectation.metaDescription,
    _yoast_wpseo_focuskw: expectation.focusKeyword,
    _yoast_wpseo_canonical: expectation.canonicalUrl,
  },
};

describe("WordPress Blog Import handoff verification", () => {
  it("passes only when every required handoff field exactly matches the created draft", () => {
    const verification = evaluateWpHandoffVerification(expectation, matchingRecord);
    expect(verification.verified).toBe(true);
    expect(verification.checks).toHaveLength(9);
    expect(verification.checks.every(check => check.state === "passed")).toBe(true);
  });

  it("fails media, category, and draft status checks when WordPress does not retain their expected values", () => {
    const verification = evaluateWpHandoffVerification(expectation, {
      ...matchingRecord,
      status: "publish",
      featured_media: 0,
      categories: [1],
    });
    expect(verification.verified).toBe(false);
    expect(verification.checks.find(check => check.key === "status")?.state).toBe("failed");
    expect(verification.checks.find(check => check.key === "featuredMedia")?.state).toBe("failed");
    expect(verification.checks.find(check => check.key === "category")?.state).toBe("failed");
  });

  it("does not pass a handoff when Yoast fields or the canonical URL are unavailable", () => {
    const verification = evaluateWpHandoffVerification(expectation, {
      ...matchingRecord,
      meta: {},
    });
    expect(verification.verified).toBe(false);
    expect(verification.checks.find(check => check.key === "seoTitle")?.state).toBe("unverified");
    expect(verification.checks.find(check => check.key === "metaDescription")?.state).toBe("unverified");
    expect(verification.checks.find(check => check.key === "focusKeyword")?.state).toBe("unverified");
    expect(verification.checks.find(check => check.key === "canonical")?.state).toBe("unverified");
  });
});
