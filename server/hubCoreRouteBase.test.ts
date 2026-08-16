import { describe, expect, it } from "vitest";
import { getHubCoreRouteBase } from "../client/src/lib/hubCoreRouteBase";

describe("Hub Core static fallback route base", () => {
  it("keeps legacy /hub tool paths relative so the cross-bundle catch-all can redirect them", () => {
    expect(getHubCoreRouteBase("/hub/yt-analytics")).toBe("/hub");
    expect(getHubCoreRouteBase("/hub/video-production")).toBe("/hub");
    expect(getHubCoreRouteBase("/hub/youtube-to-blog")).toBe("/hub");
  });

  it("preserves the canonical Core bundle base and does not impose /hub outside Hub paths", () => {
    expect(getHubCoreRouteBase("/hub/core/studio")).toBe("/hub/core");
    expect(getHubCoreRouteBase("/interconnected/thank-you-b")).toBe("/");
  });
});
