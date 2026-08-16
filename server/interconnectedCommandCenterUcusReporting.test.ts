import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../client/src/pages/InterconnectedCommandCenter.tsx", import.meta.url)),
  "utf8"
);

describe("Interconnected Command Center OCUS reporting", () => {
  it("reports the current $199 OCUS separately from the historical $299 benchmark", () => {
    expect(source).toContain("t.tier === '199'");
    expect(source).toContain("t.tier === '299'");
    expect(source).toContain("CURRENT KPI — $199 OCUS");
    expect(source).toContain("Historical $299 reference");
    expect(source).toContain("legacy benchmark, not the current $199 result");
  });

  it("does not present the historical $299 tier as the current OCUS result", () => {
    expect(source).not.toContain("PRIMARY KPI — $299 Upsell");
    expect(source).toContain("current $199 OCUS");
  });
});
