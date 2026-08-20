import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TANTRA_CONTENT_SOURCES } from "../shared/tantraContentAttribution";
import { extractTantraLineItemMetrics } from "./tantraContentAttributionRouter";

describe("Tantra content-page attribution", () => {
  it("registers all seven launched video pages with unique source keys and Wistia media IDs", () => {
    expect(TANTRA_CONTENT_SOURCES).toHaveLength(7);
    expect(new Set(TANTRA_CONTENT_SOURCES.map((source) => source.key)).size).toBe(7);
    expect(new Set(TANTRA_CONTENT_SOURCES.map((source) => source.mediaId)).size).toBe(7);
    expect(TANTRA_CONTENT_SOURCES.map((source) => source.path)).toEqual([
      "/tantra/considering-divorce",
      "/tantra/king-and-queen",
      "/tantra/sex-is-the-flower",
      "/tantra/why-he-stopped",
      "/tantra/love-bank",
      "/tantra/why-she-stopped",
      "/tantra/female-orgasm",
    ]);
  });

  it("counts only paid Tantra product line items and ignores unrelated order contents", () => {
    const metrics = extractTantraLineItemMetrics(JSON.stringify([
      { title: "Tantra Him ($185/mo)", quantity: 1, price: "185.00" },
      { title: "Tantra Bundle — Him & Her ($369/mo)", quantity: 2, price: "369.00" },
      { title: "Lights On", quantity: 1, price: "369.00" },
    ]));
    expect(metrics).toEqual({ units: 3, revenueCents: 92_300 });
    expect(extractTantraLineItemMetrics("not-json")).toEqual({ units: 0, revenueCents: 0 });
  });

  it("uses the shared attribution hook and a source-tagged quiz handoff on every launched page", () => {
    const sourcesByFile = [
      ["TantraContentDivorce.tsx", "considering-divorce"],
      ["TantraContentKingQueen.tsx", "king-and-queen"],
      ["TantraContentFlower.tsx", "sex-is-the-flower"],
      ["TantraContentHim.tsx", "why-he-stopped"],
      ["TantraContentLoveBank.tsx", "love-bank"],
      ["TantraContentWhySheStopped.tsx", "why-she-stopped"],
      ["TantraContentFemaleOrgasm.tsx", "female-orgasm"],
    ] as const;
    for (const [fileName, sourceKey] of sourcesByFile) {
      const source = readFileSync(`client/src/pages/${fileName}`, "utf8");
      expect(source).toContain('useTantraContentAttribution');
      expect(source).toContain(`sourcePage: "${sourceKey}"`);
      expect(source).toContain("href={quizUrl}");
      expect(source).toContain("onClick={onQuizCta}");
    }
  });
});
