import { describe, expect, it } from "vitest";
import { getUpstreamAudienceIntelligenceBlock } from "./upstreamAudienceIntelligence";

describe("getUpstreamAudienceIntelligenceBlock", () => {
  it("adds restoration, anti-shame, and proof guidance for relevant health content", () => {
    const context = getUpstreamAudienceIntelligenceBlock("Why 2 AM wake-ups can affect sleep and energy");
    expect(context).toContain("The Exhausted Expert");
    expect(context).toContain("restoration");
    expect(context).toContain("Self-blame is already high");
    expect(context).toContain("Never fabricate a testimonial");
  });

  it("does not apply the health persona to unrelated relationship content", () => {
    expect(getUpstreamAudienceIntelligenceBlock("The Love Bank for couples")).toBe("");
  });
});
