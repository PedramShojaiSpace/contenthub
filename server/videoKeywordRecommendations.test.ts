import { describe, expect, it } from "vitest";
import { cleanKeywordCandidates, rankKeywordRecommendations } from "./videoKeywordRecommendations";

describe("YouTube-to-blog keyword recommendations", () => {
  it("removes duplicate and unusable candidate phrases", () => {
    expect(cleanKeywordCandidates([
      { keyword: "Circadian rhythm reset", rationale: "Fits the video." },
      { keyword: "circadian rhythm reset", rationale: "Duplicate." },
      { keyword: "sleep", rationale: "Too broad." },
    ])).toEqual([{ keyword: "circadian rhythm reset", rationale: "Fits the video." }]);
  });

  it("prioritizes measurable demand and manageable difficulty, then blends vidIQ opportunity", () => {
    const ranked = rankKeywordRecommendations([
      {
        keyword: "circadian rhythm reset", rationale: "Specific topic.", searchVolume: 5400,
        keywordDifficulty: 28, cpc: 1.5, intent: "informational", vidiqOpportunity: 70,
        vidiqVolume: 65, vidiqCompetition: 31,
      },
      {
        keyword: "sleep health", rationale: "Broad topic.", searchVolume: 12000,
        keywordDifficulty: 88, cpc: 2.2, intent: "informational", vidiqOpportunity: null,
        vidiqVolume: null, vidiqCompetition: null,
      },
    ]);

    expect(ranked[0].keyword).toBe("circadian rhythm reset");
    expect(ranked[0].sources).toEqual(["dataforseo", "vidiq"]);
    expect(ranked[0].combinedOpportunity).not.toBeNull();
  });
});
