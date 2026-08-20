import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../client/src/pages/InterconnectedCommandCenter.tsx", import.meta.url)),
  "utf8"
);

describe("Interconnected Command Center Meta refresh guardrail", () => {
  it("does not query Meta on page load or polling", () => {
    expect(source).not.toContain("getMetaSpend.useQuery");
    expect(source).toContain("getOptPathPerformance.useQuery");
    expect(source).toContain("enabled: false");
    expect(source).toContain("refetchInterval: false");
    expect(source).toContain("refetchOnMount: false");
    expect(source).toContain("refetchOnWindowFocus: false");
  });

  it("uses the scorecard endpoint as the one explicit Meta refresh path", () => {
    expect(source).toContain("refetchOptPerf(), refetchFunnel()");
    expect(source).toContain("optPerfData?.meta");
    expect(source).toContain("Press Refresh for one Meta snapshot");
  });
});
