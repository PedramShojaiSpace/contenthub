import { describe, expect, it } from "vitest";
import { normalizeHostname, shouldRenderUpstreamAtRoot } from "../client/src/lib/hostnameRouting";

describe("Upstream custom-host routing", () => {
  it("renders the existing Upstream page at the custom hostname root", () => {
    expect(shouldRenderUpstreamAtRoot("upstream.theurbanmonk.com", "/")).toBe(true);
  });

  it("normalizes case, a trailing dot, and development ports safely", () => {
    expect(normalizeHostname("UPSTREAM.THEURBANMONK.COM.:443")).toBe("upstream.theurbanmonk.com");
    expect(shouldRenderUpstreamAtRoot("upstream.theurbanmonk.com:3000", "/")).toBe(true);
  });

  it("preserves the Content Hub root and explicit paths", () => {
    expect(shouldRenderUpstreamAtRoot("content.theurbanmonk.com", "/")).toBe(false);
    expect(shouldRenderUpstreamAtRoot("upstream.theurbanmonk.com", "/upstream")).toBe(false);
    expect(shouldRenderUpstreamAtRoot("lightsebook-iugsiz76.manus.space", "/")).toBe(false);
  });
});
