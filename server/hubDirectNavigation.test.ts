import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(new URL(`../client/src/${relativePath}`, import.meta.url), "utf8");

describe("high-risk Hub navigation", () => {
  it("routes the audited cross-bundle viral-studio links through the shared resolver", () => {
    const files = [
      "pages/CommandCenter.tsx",
      "pages/ManyChatWizard.tsx",
      "pages/VideoVariantFactory.tsx",
      "pages/viral/HookGenerator.tsx",
    ];

    for (const file of files) {
      expect(source(file)).toContain("getHubPublicHref");
    }

    expect(source("pages/CommandCenter.tsx")).not.toContain('setLocation("/viral-studio')
    expect(source("pages/viral/HookGenerator.tsx")).not.toContain('setLocation("/viral-studio')
    expect(source("pages/ManyChatWizard.tsx")).not.toContain('href="/viral-studio"')
    expect(source("pages/VideoVariantFactory.tsx")).not.toContain('href="/viral-studio?tab=testing"')
  });

  it("routes the audited Studio link through the shared resolver", () => {
    const intelligenceDashboard = source("pages/IntelligenceDashboard.tsx");

    expect(intelligenceDashboard).toContain("getHubPublicHref");
    expect(intelligenceDashboard).not.toContain('href="/studio"');
  });
});
