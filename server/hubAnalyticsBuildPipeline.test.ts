import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../scripts/build.mjs", import.meta.url)),
  "utf8"
);

describe("staged Hub Analytics build pipeline", () => {
  it("clears stale Hub output before rebuilding each staged bundle", () => {
    expect(source).toContain("async function cleanBundleOutput");
    expect(source).toContain("await cleanBundleOutput(bundle)");
    expect(source).toContain("rm(outputDir, { recursive: true, force: true })");
  });

  it("verifies the repaired Command Center chunk before a deployment build succeeds", () => {
    expect(source).toContain("async function validateBundleOutput");
    expect(source).toContain("getLiveInterconnectedPurchases");
    expect(source).toContain("Direct Kajabi source");
    expect(source).toContain("await validateBundleOutput(bundle)");
  });
});
