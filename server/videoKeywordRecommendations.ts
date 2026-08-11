export interface KeywordResearchSignal {
  keyword: string;
  rationale: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  intent: string | null;
  vidiqOpportunity: number | null;
  vidiqVolume: number | null;
  vidiqCompetition: number | null;
}

export interface RankedKeywordRecommendation extends KeywordResearchSignal {
  googleOpportunity: number | null;
  combinedOpportunity: number | null;
  sources: Array<"dataforseo" | "vidiq">;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Ranks candidate keywords using transparent signals, not an LLM’s unsupported
 * claim that a phrase is “best.” Google opportunity rewards searchable demand
 * and manageable difficulty; vidIQ opportunity is blended when it is available.
 */
export function rankKeywordRecommendations(signals: KeywordResearchSignal[]): RankedKeywordRecommendation[] {
  return signals
    .map((signal) => {
      const hasGoogleData = signal.searchVolume !== null || signal.keywordDifficulty !== null;
      const demand = signal.searchVolume === null ? 0 : Math.min(55, Math.log10(signal.searchVolume + 1) * 14);
      const difficulty = signal.keywordDifficulty === null ? 0 : Math.max(0, 45 - signal.keywordDifficulty) * 0.8;
      const intentBonus = signal.intent === "informational" || signal.intent === "commercial" ? 8 : 0;
      const googleOpportunity = hasGoogleData ? clamp(demand + difficulty + intentBonus) : null;
      const combinedOpportunity = googleOpportunity === null && signal.vidiqOpportunity === null
        ? null
        : googleOpportunity === null
          ? clamp(signal.vidiqOpportunity ?? 0)
          : signal.vidiqOpportunity === null
            ? googleOpportunity
            : clamp(googleOpportunity * 0.6 + signal.vidiqOpportunity * 0.4);

      return {
        ...signal,
        googleOpportunity,
        combinedOpportunity,
        sources: [
          ...(hasGoogleData ? ["dataforseo" as const] : []),
          ...(signal.vidiqOpportunity !== null ? ["vidiq" as const] : []),
        ],
      };
    })
    .sort((a, b) => (b.combinedOpportunity ?? -1) - (a.combinedOpportunity ?? -1));
}

export function cleanKeywordCandidates(candidates: Array<{ keyword: string; rationale: string }>) {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      keyword: candidate.keyword
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
      rationale: candidate.rationale.trim(),
    }))
    .filter((candidate) => {
      const wordCount = candidate.keyword.split(" ").filter(Boolean).length;
      if (wordCount < 2 || wordCount > 6 || seen.has(candidate.keyword)) return false;
      seen.add(candidate.keyword);
      return true;
    })
    .slice(0, 6);
}
