/**
 * Tests for v126: UTM ↔ Content Pipeline Integration
 * Verifies that appendUtmToCtaUrl correctly injects utm_content,
 * PLATFORM_UTM map is complete and synced, and getUtmForPlatform works.
 */
import { describe, it, expect } from "vitest";
import { appendUtmToCtaUrl, PLATFORM_UTM, getUtmForPlatform } from "./ctaRouter";

describe("PLATFORM_UTM taxonomy", () => {
  const EXPECTED_PLATFORMS = [
    "blog", "youtube", "meta", "instagram", "facebook",
    "linkedin", "x", "tiktok", "podcast", "email", "newsletter", "script", "all",
  ];

  it("covers all expected platforms", () => {
    for (const platform of EXPECTED_PLATFORMS) {
      expect(PLATFORM_UTM[platform], `Missing platform: ${platform}`).toBeDefined();
    }
  });

  it("every platform entry has source, medium, and content", () => {
    for (const [platform, utm] of Object.entries(PLATFORM_UTM)) {
      expect(utm.source, `${platform}.source missing`).toBeTruthy();
      expect(utm.medium, `${platform}.medium missing`).toBeTruthy();
      expect(utm.content, `${platform}.content missing`).toBeTruthy();
    }
  });

  it("blog uses organic-content medium and inline-cta content", () => {
    expect(PLATFORM_UTM.blog.medium).toBe("organic-content");
    expect(PLATFORM_UTM.blog.content).toBe("inline-cta");
  });

  it("meta uses paid-social medium", () => {
    expect(PLATFORM_UTM.meta.medium).toBe("paid-social");
  });

  it("email and newsletter use email medium", () => {
    expect(PLATFORM_UTM.email.medium).toBe("email");
    expect(PLATFORM_UTM.newsletter.medium).toBe("email");
  });
});

describe("appendUtmToCtaUrl with utm_content", () => {
  const BASE_URL = "https://lightson.theurbanmonk.com/";

  it("appends all four UTM params including utm_content", () => {
    const result = appendUtmToCtaUrl(BASE_URL, "blog", "lights-on", "inline-cta");
    const url = new URL(result);
    expect(url.searchParams.get("utm_source")).toBe("blog");
    expect(url.searchParams.get("utm_medium")).toBe("organic-content");
    expect(url.searchParams.get("utm_campaign")).toBe("lights-on");
    expect(url.searchParams.get("utm_content")).toBe("inline-cta");
  });

  it("uses platform default utm_content when no override provided", () => {
    const result = appendUtmToCtaUrl(BASE_URL, "instagram", "ic-free-screening");
    const url = new URL(result);
    expect(url.searchParams.get("utm_content")).toBe("reel");
  });

  it("uses provided contentOverride when given", () => {
    const result = appendUtmToCtaUrl(BASE_URL, "instagram", "ic-free-screening", "story");
    const url = new URL(result);
    expect(url.searchParams.get("utm_content")).toBe("story");
  });

  it("returns empty string for null URL", () => {
    expect(appendUtmToCtaUrl(null, "blog")).toBe("");
  });

  it("falls back gracefully for unknown platform", () => {
    const result = appendUtmToCtaUrl(BASE_URL, "unknown-platform", "test-campaign");
    expect(result).toContain("utm_source=unknown-platform");
    expect(result).toContain("utm_content=content");
  });

  it("handles URLs that already have query params", () => {
    const urlWithParams = "https://lightson.theurbanmonk.com/?ref=podcast";
    const result = appendUtmToCtaUrl(urlWithParams, "podcast", "upstream-webinar");
    const url = new URL(result);
    expect(url.searchParams.get("ref")).toBe("podcast");
    expect(url.searchParams.get("utm_source")).toBe("podcast");
    expect(url.searchParams.get("utm_content")).toBe("episode-description");
  });
});

describe("getUtmForPlatform", () => {
  it("returns correct UTM for known platform", () => {
    const utm = getUtmForPlatform("linkedin");
    expect(utm.source).toBe("linkedin");
    expect(utm.medium).toBe("organic-social");
    expect(utm.content).toBe("post");
  });

  it("returns fallback for unknown platform", () => {
    const utm = getUtmForPlatform("unknown");
    expect(utm.source).toBe("unknown");
    expect(utm.medium).toBe("organic-content");
    expect(utm.content).toBe("content");
  });

  it("youtube returns video medium and video-description content", () => {
    const utm = getUtmForPlatform("youtube");
    expect(utm.medium).toBe("video");
    expect(utm.content).toBe("video-description");
  });
});
