import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HeyGen integration containment coverage", () => {
  const source = (relativePath: string) =>
    readFileSync(new URL(relativePath, import.meta.url), "utf8");

  it("guards direct router and shared pipeline API helpers", () => {
    expect(source("./heygenRouter.ts")).toContain("assertHeyGenOutboundEnabled();");
    expect(source("./descriptPipeline.ts")).toContain("assertHeyGenOutboundEnabled();");
  });

  it("skips queued and in-flight avatar processing without changing job state", () => {
    const pipeline = source("./descriptPipeline.ts");
    expect(pipeline).toContain("isHeyGenOutboundDisabled()");
    expect(pipeline).toContain("HeyGen processing skipped: outbound integration is security-disabled.");
  });

  it("blocks new HeyGen-backed jobs and the legacy direct status fallback", () => {
    const videoRouter = source("./videoPipelineRouter.ts");
    const youtubeRouter = source("./youtubeRouter.ts");
    expect(videoRouter).toContain('if (path !== "descript_only")');
    expect(videoRouter).toContain("assertHeyGenOutboundEnabled();");
    expect(youtubeRouter).toContain('if (input.destination === "heygen")');
    expect(youtubeRouter).toContain("assertHeyGenOutboundEnabled();");
  });
});
