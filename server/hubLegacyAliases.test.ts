import { describe, expect, it } from "vitest";
import { getLegacyHubAliasHref } from "./hubLegacyAliases";

describe("legacy Hub route aliases", () => {
  it("redirects the legacy YouTube-to-Blog URL to the active Content-bundle route", () => {
    expect(getLegacyHubAliasHref("/hub/youtube-to-blog", "?source=legacy"))
      .toBe("/hub/content/video-to-blog?source=legacy");
  });

  it("leaves non-legacy Hub paths alone", () => {
    expect(getLegacyHubAliasHref("/hub/content/video-to-blog")).toBeNull();
    expect(getLegacyHubAliasHref("/hub/growth/yt-analytics")).toBeNull();
  });
});
