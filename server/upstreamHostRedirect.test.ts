import { describe, expect, it } from "vitest";
import {
  getUpstreamFallbackLocation,
  isUpstreamHostname,
  UPSTREAM_FALLBACK_URL,
} from "./upstreamHostRedirect";

describe("Upstream temporary host redirect", () => {
  it("recognizes only the dedicated Upstream hostname", () => {
    expect(isUpstreamHostname("upstream.theurbanmonk.com")).toBe(true);
    expect(isUpstreamHostname("UPSTREAM.THEURBANMONK.COM.:443")).toBe(true);
    expect(isUpstreamHostname("content.theurbanmonk.com")).toBe(false);
    expect(isUpstreamHostname("lightsebook-iugsiz76.manus.space")).toBe(false);
  });

  it("sends root traffic to the verified public landing page", () => {
    expect(getUpstreamFallbackLocation("/")).toBe(UPSTREAM_FALLBACK_URL);
  });

  it("preserves incoming campaign parameters", () => {
    expect(getUpstreamFallbackLocation("/?utm_source=meta&utm_campaign=upstream&fbclid=abc123"))
      .toBe(`${UPSTREAM_FALLBACK_URL}?utm_source=meta&utm_campaign=upstream&fbclid=abc123`);
  });
});
