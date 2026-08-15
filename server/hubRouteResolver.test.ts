import { describe, expect, it } from "vitest";
import { getHubBundleForPath, getHubNavigationHref, getHubPublicHref } from "../client/src/lib/hubRouteResolver";

describe("Hub cross-bundle route resolver", () => {
  it("routes YouTube Analytics to the growth bundle", () => {
    expect(getHubBundleForPath("/yt-analytics")).toBe("growth");
    expect(getHubPublicHref("/yt-analytics")).toBe("/hub/growth/yt-analytics");
  });

  it("routes heavyweight creative-production tools to the content bundle", () => {
    expect(getHubBundleForPath("/video-production")).toBe("content");
    expect(getHubPublicHref("/ebook-generator")).toBe("/hub/content/ebook-generator");
  });

  it("normalizes a full wrong-bundle URL before redirecting to its owner", () => {
    expect(getHubPublicHref("/hub/core/video-production", "?source=deep-link"))
      .toBe("/hub/content/video-production?source=deep-link");
    expect(getHubPublicHref("/core/video-production"))
      .toBe("/hub/content/video-production");
  });

  it("redirects a cross-bundle sidebar selection without rewriting same-bundle navigation", () => {
    expect(getHubNavigationHref("/yt-analytics", "/hub/analytics/reconciliation", "?view=week"))
      .toBe("/hub/growth/yt-analytics?view=week");
    expect(getHubNavigationHref("/reconciliation", "/hub/analytics/tantra-funnel"))
      .toBeNull();
  });
});
