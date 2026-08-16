import { describe, expect, it } from "vitest";
import { buildLiveRunBrief, getWebinarBasePreset, makeIntelligenceDigest, resolveWebinarDeckProfile } from "../client/src/lib/webinarLiveRunConfig";

describe("reusable webinar live-run configuration", () => {
  it("selects the sleep base deck only for sleep-relevant webinar topics", () => {
    expect(resolveWebinarDeckProfile("Deep Sleep: Reclaim Your Night").key).toBe("sleep");
    expect(resolveWebinarDeckProfile("Upstream Health: Find Your Root Cause").key).toBe("upstream");
  });

  it("uses Typeform intelligence to refresh limited zones while preserving the foundation deck", () => {
    const digest = makeIntelligenceDigest([
      {
        responseCount: 18,
        extractedThemes: JSON.stringify(["2–4 AM waking", "daytime exhaustion"]),
        extractedQuestions: JSON.stringify(["Why do I wake up at 3 AM?", "Can I fix this without another supplement?"]),
        extractedLanguage: JSON.stringify(["I am tired of paying for another thing that does not work."]),
      },
    ]);
    const brief = buildLiveRunBrief("Deep Sleep Masterclass", digest);

    expect(brief.profile.foundationSlides).toContain("Gut, vagus, and autonomic-state teaching arc");
    expect(brief.profile.assetStatus).toBe("verified");
    expect(brief.profile.sourceDeck.slideCount).toBe(57);
    expect(brief.profile.sourceDeck.managedAssetPath).toContain("Deep_Sleep_Solution_Keynote_Backup");
    expect(brief.refreshPlan).toHaveLength(4);
    expect(brief.refreshPlan[0]?.source).toContain("tired of paying");
    expect(brief.refreshPlan[1]?.source).toContain("2–4 AM waking");
    expect(brief.refreshPlan[2]?.source).toContain("Why do I wake up at 3 AM?");
  });

  it("keeps verified base-deck metadata explicit for both Upstream and Deep Sleep", () => {
    expect(resolveWebinarDeckProfile("Upstream Health").assetStatus).toBe("verified");
    expect(resolveWebinarDeckProfile("Upstream Health").sourceDeck.slideCount).toBe(37);
    expect(resolveWebinarDeckProfile("Deep Sleep").assetNote).toContain("57 slides");
  });

  it("returns base-deck defaults without mutating a saved webinar session", () => {
    expect(getWebinarBasePreset("sleep")).toEqual({
      topic: "Deep Sleep: Restore the Night, Reclaim the Day",
      cta: "Join the Deep Sleep program and begin your restorative-sleep protocol",
    });
    expect(getWebinarBasePreset("upstream").topic).toContain("Upstream Health");
  });
});
