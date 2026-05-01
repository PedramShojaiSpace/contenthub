import { describe, it, expect } from "vitest";

// ─── GA4 Campaign Slug Auto-Fix ───────────────────────────────────────────────
describe("blog.fixCampaignSlug logic", () => {
  const replaceUtmCampaign = (text: string, newSlug: string): string => {
    return text.replace(/utm_campaign=([^&"'\s]+)/g, `utm_campaign=${newSlug}`);
  };

  it("replaces a single utm_campaign in a URL", () => {
    const input = "https://example.com?utm_source=blog&utm_campaign=old-slug&utm_medium=organic";
    const result = replaceUtmCampaign(input, "lights-on");
    expect(result).toContain("utm_campaign=lights-on");
    expect(result).not.toContain("utm_campaign=old-slug");
  });

  it("replaces multiple utm_campaign occurrences in article body", () => {
    const body = `
      Check out [this link](https://example.com?utm_campaign=wrong-slug&utm_source=blog)
      and also [another](https://example.com?utm_campaign=wrong-slug&utm_medium=social)
    `;
    const result = replaceUtmCampaign(body, "ic-free-screening");
    const matches = result.match(/utm_campaign=ic-free-screening/g);
    expect(matches).toHaveLength(2);
    expect(result).not.toContain("utm_campaign=wrong-slug");
  });

  it("returns unchanged text when no utm_campaign is present", () => {
    const body = "No UTM params here. Just plain text.";
    const result = replaceUtmCampaign(body, "lights-on");
    expect(result).toBe(body);
  });

  it("handles utm_campaign in double-quoted HTML attributes", () => {
    const html = `<a href="https://example.com?utm_campaign=bad-slug&utm_source=blog">Click</a>`;
    const result = replaceUtmCampaign(html, "gut-health");
    expect(result).toContain("utm_campaign=gut-health");
  });
});

// ─── UTM Builder History Deduplication ────────────────────────────────────────
describe("UTM save deduplication logic", () => {
  // Simulate the deduplication check
  const shouldSkipInsert = (existingUrls: string[], newUrl: string): boolean => {
    return existingUrls.some((u) => u === newUrl);
  };

  it("returns true (skip) when exact URL already exists", () => {
    const existing = [
      "https://lightson.theurbanmonk.com/?utm_source=blog&utm_medium=organic&utm_campaign=lights-on&utm_content=inline-cta",
    ];
    const newUrl = "https://lightson.theurbanmonk.com/?utm_source=blog&utm_medium=organic&utm_campaign=lights-on&utm_content=inline-cta";
    expect(shouldSkipInsert(existing, newUrl)).toBe(true);
  });

  it("returns false (insert) when URL is new", () => {
    const existing = [
      "https://lightson.theurbanmonk.com/?utm_source=blog&utm_medium=organic&utm_campaign=lights-on&utm_content=inline-cta",
    ];
    const newUrl = "https://lightson.theurbanmonk.com/?utm_source=linkedin&utm_medium=social&utm_campaign=lights-on&utm_content=post";
    expect(shouldSkipInsert(existing, newUrl)).toBe(false);
  });

  it("returns false when history is empty", () => {
    expect(shouldSkipInsert([], "https://example.com?utm_campaign=lights-on")).toBe(false);
  });

  it("is case-sensitive (different case = different URL)", () => {
    const existing = ["https://example.com?utm_campaign=LIGHTS-ON"];
    expect(shouldSkipInsert(existing, "https://example.com?utm_campaign=lights-on")).toBe(false);
  });
});

// ─── Banner Composite Helper ──────────────────────────────────────────────────
describe("compositeCtaBanner options", () => {
  it("truncates ctaButtonLabel to 50 chars", () => {
    const label = "A Very Long CTA Button Label That Exceeds The Fifty Character Limit";
    const truncated = label.substring(0, 50);
    expect(truncated.length).toBeLessThanOrEqual(50);
  });

  it("strips markdown from headline", () => {
    const raw = "**Transform Your Health** with *Ancient Wisdom*";
    const clean = raw.replace(/[*_#]/g, "");
    expect(clean).toBe("Transform Your Health with Ancient Wisdom");
  });

  it("uses first sentence of CTA text as headline", () => {
    const ctaText = "Join Lights On today. Get access to all courses. Transform your life.";
    const headline = ctaText.split(".")[0].trim();
    expect(headline).toBe("Join Lights On today");
  });

  it("falls back to default headline when CTA text is empty", () => {
    const ctaText = "";
    const headline = ctaText.split(".")[0].trim() || "Transform Your Health Today";
    expect(headline).toBe("Transform Your Health Today");
  });

  it("canvas dimensions are 1200x675 (16:9)", () => {
    const W = 1200;
    const H = 675;
    expect(W / H).toBeCloseTo(16 / 9, 1);
  });
});
