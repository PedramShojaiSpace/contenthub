import { describe, expect, it } from "vitest";
import { getHubBundleForPath, getHubNavigationHref, getHubPublicHref } from "../client/src/lib/hubRouteResolver";

describe("Hub cross-bundle route resolver", () => {
  it("routes YouTube Analytics to the growth bundle", () => {
    expect(getHubBundleForPath("/yt-analytics")).toBe("growth");
    expect(getHubPublicHref("/yt-analytics")).toBe("/hub/growth/yt-analytics");
  });

  it("redirects a cross-bundle sidebar selection without rewriting same-bundle navigation", () => {
    expect(getHubNavigationHref("/yt-analytics", "/hub/analytics/reconciliation", "?view=week"))
      .toBe("/hub/growth/yt-analytics?view=week");
    expect(getHubNavigationHref("/reconciliation", "/hub/analytics/tantra-funnel"))
      .toBeNull();
  });
});
