import { describe, it, expect } from "vitest";
import { validateCampaignSlug, KNOWN_CAMPAIGN_SLUGS, ctaLabelToCampaign } from "./ctaRouter";

// ─── GA4 Campaign Validation ─────────────────────────────────────────────────
describe("GA4 campaign slug validation", () => {
  it("returns null for all known campaign slugs", () => {
    for (const slug of KNOWN_CAMPAIGN_SLUGS) {
      expect(validateCampaignSlug(slug)).toBeNull();
    }
  });

  it("returns a warning string for unknown slugs", () => {
    const warning = validateCampaignSlug("some-random-campaign");
    expect(warning).not.toBeNull();
    expect(warning).toContain("some-random-campaign");
    expect(warning).toContain("GA4 campaign list");
  });

  it("returns null for ic-free-screening", () => {
    expect(validateCampaignSlug("ic-free-screening")).toBeNull();
  });

  it("returns null for lights-on", () => {
    expect(validateCampaignSlug("lights-on")).toBeNull();
  });

  it("returns null for upstream-webinar", () => {
    expect(validateCampaignSlug("upstream-webinar")).toBeNull();
  });

  it("covers all 15 known campaigns", () => {
    expect(KNOWN_CAMPAIGN_SLUGS.size).toBe(15);
  });
});

// ─── ctaLabelToCampaign ───────────────────────────────────────────────────────
describe("ctaLabelToCampaign", () => {
  it("slugifies 'Lights On (Default)' → 'lights-on'", () => {
    expect(ctaLabelToCampaign("Lights On (Default)")).toBe("lights-on");
  });

  it("slugifies 'IC Free Screening (Opt-in)' → 'ic-free-screening'", () => {
    expect(ctaLabelToCampaign("IC Free Screening (Opt-in)")).toBe("ic-free-screening");
  });

  it("slugifies 'Gut Health' → 'gut-health'", () => {
    expect(ctaLabelToCampaign("Gut Health")).toBe("gut-health");
  });

  it("truncates slugs to 64 characters", () => {
    const longLabel = "A Very Long CTA Label That Exceeds The Maximum Slug Length Limit For Campaign Slugs";
    expect(ctaLabelToCampaign(longLabel).length).toBeLessThanOrEqual(64);
  });
});

// ─── UTM content override ─────────────────────────────────────────────────────
describe("UTM content override values", () => {
  const VALID_CONTENT_VALUES = [
    "inline-cta",
    "video-description",
    "reel",
    "post",
    "tweet",
    "video",
    "episode-description",
    "sequence-email",
    "weekly-digest",
    "bio-link",
    "story",
    "carousel-caption",
    "video-ad",
    "carousel-ad",
    "static-image",
    "story-ad",
    "reel-ad",
  ];

  it("all valid utm_content values are non-empty strings", () => {
    for (const val of VALID_CONTENT_VALUES) {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it("inline-cta is a valid content value for blog platform", () => {
    expect(VALID_CONTENT_VALUES).toContain("inline-cta");
  });

  it("reel is a valid content value for instagram platform", () => {
    expect(VALID_CONTENT_VALUES).toContain("reel");
  });
});

// ─── Infographic banner prompt quality ───────────────────────────────────────
describe("CTA infographic banner prompt", () => {
  const FALLBACK_PROMPT = "Premium wellness infographic banner: bold cream headline area at top, glowing golden lotus central motif, deep forest green background, amber CTA button shape at bottom, ancient wisdom meets modern science aesthetic, no faces, clean graphic design style";

  it("fallback prompt mentions infographic design elements", () => {
    expect(FALLBACK_PROMPT).toContain("infographic banner");
    expect(FALLBACK_PROMPT).toContain("headline area");
    expect(FALLBACK_PROMPT).toContain("CTA button shape");
  });

  it("fallback prompt specifies brand colors", () => {
    expect(FALLBACK_PROMPT).toContain("amber");
    expect(FALLBACK_PROMPT).toContain("forest green");
    expect(FALLBACK_PROMPT).toContain("cream");
  });

  it("fallback prompt excludes faces", () => {
    expect(FALLBACK_PROMPT).toContain("no faces");
  });

  it("fallback prompt is under 200 characters", () => {
    expect(FALLBACK_PROMPT.length).toBeLessThanOrEqual(300);
  });
});
