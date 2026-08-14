import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Ads Manager Content Traffic fallback", () => {
  it("keeps the review workspace available while Meta status is pending or unavailable", () => {
    const source = readFileSync(new URL("../client/src/pages/AdsManager.tsx", import.meta.url), "utf8");
    expect(source).toContain("ContentTrafficFallback");
    expect(source).toContain("The Content Traffic review workspace remains available now");
    expect(source).toContain("paused-draft creation will stay blocked until the connection is restored");
  });
});
