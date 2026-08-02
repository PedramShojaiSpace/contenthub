import { describe, it, expect } from "vitest";
import {
  composePatterns,
  outlierEffectiveness,
  describeComposition,
  sourceRankOf,
  TYPE_QUOTAS,
  MAX_COMPOSED,
  MIN_GLOBAL_EFFECTIVENESS,
  type CompositionCandidate,
} from "./patternComposition";

let nextId = 1;
function pat(
  patternType: string,
  effectivenessScore: number | null,
  opts: Partial<CompositionCandidate> = {}
): CompositionCandidate {
  return {
    id: opts.id ?? nextId++,
    patternType,
    patternText: opts.patternText ?? `${patternType} text ${nextId}`,
    patternContext: opts.patternContext ?? null,
    effectivenessScore,
    sourceVideoId: opts.sourceVideoId ?? null,
    tags: opts.tags ?? null,
    usageCount: opts.usageCount ?? 0,
  };
}

describe("outlierEffectiveness — variance preservation", () => {
  /*
   * The regression this whole function exists for: the old mapping was
   * min(0.9, max(0.5, score / 10)), so every outlier score >= 9 produced
   * exactly 0.9. Health-niche outlier scores are routinely 9-60, so 13 of 15
   * real rows pinned to the ceiling and "order by effectiveness" sorted on a
   * constant.
   */
  it("does not saturate across the real observed outlier range", () => {
    const scores = [9, 12, 15, 20, 30, 45, 60];
    const effs = scores.map(outlierEffectiveness);
    const unique = new Set(effs);
    // The old mapping produced ONE distinct value here. Anything less than a
    // distinct value per input means variance is still being destroyed.
    expect(unique.size).toBe(scores.length);
  });

  it("is strictly monotonic — a better outlier always scores higher", () => {
    const scores = [1, 3, 5, 9, 15, 30, 60, 90];
    for (let i = 1; i < scores.length; i++) {
      expect(outlierEffectiveness(scores[i])).toBeGreaterThan(
        outlierEffectiveness(scores[i - 1])
      );
    }
  });

  it("keeps competitor patterns below the operator's own analog data", () => {
    // patternExtractorRouter inserts operator analog data at 0.8 by default.
    // Competitor research must stay rankable beneath it even at extreme scores.
    expect(outlierEffectiveness(1000)).toBeLessThanOrEqual(0.9);
    expect(outlierEffectiveness(60)).toBeLessThan(0.9);
  });

  it("stays inside the 0-1 effectiveness band for absurd and invalid input", () => {
    for (const v of [0, -5, Number.NaN, null, undefined, 1e9]) {
      const e = outlierEffectiveness(v as number);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });

  it("treats an unknown score as mid-band, not as worst", () => {
    // An unmeasured video is not a bad video. Scoring it 0 would bury every
    // pattern from a video vidIQ had no outlier data for.
    expect(outlierEffectiveness(null)).toBe(0.6);
  });
});

describe("composePatterns — research preference", () => {
  it("prefers research-tagged patterns over stronger global ones", () => {
    const candidates = [
      pat("proof_element", 0.88, { id: 100 }), // strong but global
      pat("proof_element", 0.55, {
        id: 200,
        tags: ["research_job_7", "competitor_research"],
        sourceVideoId: "vidA",
      }),
    ];
    const c = composePatterns(candidates, {
      researchJobId: 7,
      rankedVideoIds: ["vidA"],
    });
    // The research pattern must be composed FIRST despite the lower score:
    // relevance to this topic outranks a global average.
    expect(c.patterns[0].id).toBe(200);
    expect(c.patterns[0].origin).toBe("research");
    expect(c.researchCount).toBe(1);
  });

  it("orders research patterns by source-video discovery rank", () => {
    const candidates = [
      pat("proof_element", 0.5, { id: 3, tags: ["research_job_1"], sourceVideoId: "third" }),
      pat("proof_element", 0.5, { id: 1, tags: ["research_job_1"], sourceVideoId: "first" }),
      pat("proof_element", 0.5, { id: 2, tags: ["research_job_1"], sourceVideoId: "second" }),
    ];
    const c = composePatterns(candidates, {
      researchJobId: 1,
      rankedVideoIds: ["first", "second", "third"],
    });
    expect(c.patterns.map((p) => p.sourceVideoId)).toEqual(["first", "second", "third"]);
  });

  it("ignores research tags from a different job", () => {
    const candidates = [
      pat("hook", 0.5, { id: 10, tags: ["research_job_99"], sourceVideoId: "x" }),
    ];
    const c = composePatterns(candidates, { researchJobId: 7, rankedVideoIds: ["x"] });
    // Job 99's patterns are not this topic's research — they compete globally.
    expect(c.researchCount).toBe(0);
    expect(c.patterns[0]?.origin).toBe("global");
  });

  it("admits research patterns below the global effectiveness floor", () => {
    const weak = pat("cta", 0.15, { id: 5, tags: ["research_job_2"], sourceVideoId: "v" });
    const c = composePatterns([weak], { researchJobId: 2, rankedVideoIds: ["v"] });
    expect(c.patterns).toHaveLength(1);
    expect(c.patterns[0].origin).toBe("research");
  });
});

describe("composePatterns — quota-aware sweep", () => {
  /*
   * THE SPEC'S NAMED FAILURE MODE: "a corpus rich in weak hooks must not
   * overfill the hook quota just because hooks are plentiful."
   *
   * Every research job mines one hook reference per video, so hooks really are
   * the most plentiful type in this corpus.
   */
  it("does not exceed the hook quota in a hook-rich corpus", () => {
    const candidates = [
      ...Array.from({ length: 200 }, () => pat("hook", 0.55)),
      pat("proof_element", 0.85),
      pat("pain_point", 0.8),
    ];
    const c = composePatterns(candidates);
    expect(c.byType.hook).toBeLessThanOrEqual(TYPE_QUOTAS.hook);
    // And the scarce strong types still get in — they are not crowded out.
    expect(c.byType.proof_element).toBeGreaterThan(0);
    expect(c.byType.pain_point).toBeGreaterThan(0);
  });

  it("respects every per-type quota, not just hooks", () => {
    const candidates = Object.keys(TYPE_QUOTAS).flatMap((t) =>
      Array.from({ length: 30 }, () => pat(t, 0.7))
    );
    const c = composePatterns(candidates);
    for (const [type, count] of Object.entries(c.byType)) {
      expect(count).toBeLessThanOrEqual(TYPE_QUOTAS[type]);
    }
  });

  it("caps the composed total", () => {
    const candidates = Object.keys(TYPE_QUOTAS).flatMap((t) =>
      Array.from({ length: 10 }, () => pat(t, 0.9))
    );
    const c = composePatterns(candidates);
    expect(c.patterns.length).toBeLessThanOrEqual(MAX_COMPOSED);
  });

  it("excludes global patterns below the effectiveness floor", () => {
    const candidates = [
      pat("hook", MIN_GLOBAL_EFFECTIVENESS - 0.01, { id: 1 }),
      pat("hook", MIN_GLOBAL_EFFECTIVENESS + 0.01, { id: 2 }),
      pat("hook", null, { id: 3 }),
    ];
    const c = composePatterns(candidates);
    expect(c.composedIds).toEqual([2]);
  });

  it("prefers the less-used pattern when effectiveness ties", () => {
    const candidates = [
      pat("cta", 0.7, { id: 1, usageCount: 40 }),
      pat("cta", 0.7, { id: 2, usageCount: 0 }),
    ];
    const c = composePatterns(candidates);
    // cta quota is 1, so this asserts rotation rather than hammering one row.
    expect(c.composedIds).toEqual([2]);
  });

  it("is deterministic for identical input", () => {
    const build = () => [
      pat("hook", 0.7, { id: 1 }),
      pat("hook", 0.7, { id: 2 }),
      pat("proof_element", 0.6, { id: 3 }),
    ];
    const a = composePatterns(build());
    const b = composePatterns(build());
    expect(a.composedIds).toEqual(b.composedIds);
  });
});

describe("composePatterns — unfilled type reporting", () => {
  it("names types the corpus could not cover at all", () => {
    const c = composePatterns([pat("hook", 0.8), pat("pain_point", 0.8)]);
    expect(c.unfilledTypes).toContain("proof_element");
    expect(c.unfilledTypes).toContain("cta");
    expect(c.unfilledTypes).not.toContain("hook");
    expect(c.unfilledTypes).not.toContain("pain_point");
  });

  it("does not report unfilled types when the total cap was the limit", () => {
    // Cap-limited is the cap working, not thin coverage. Reporting it would
    // train the operator to ignore the disclosure.
    const candidates = Object.keys(TYPE_QUOTAS).flatMap((t) =>
      Array.from({ length: 5 }, () => pat(t, 0.9))
    );
    const c = composePatterns(candidates);
    expect(c.patterns.length).toBe(MAX_COMPOSED);
    expect(c.unfilledTypes).toEqual([]);
  });

  it("reports everything unfilled for an empty corpus", () => {
    const c = composePatterns([]);
    expect(c.patterns).toHaveLength(0);
    expect(c.unfilledTypes.length).toBe(Object.keys(TYPE_QUOTAS).length);
  });

  it("honours an explicit selectedTypes override", () => {
    const candidates = [pat("hook", 0.9), pat("cta", 0.9), pat("proof_element", 0.9)];
    const c = composePatterns(candidates, { selectedTypes: ["hook", "cta"] });
    expect(Object.keys(c.byType).sort()).toEqual(["cta", "hook"]);
    // A type that was never eligible is not "unfilled" — it was not requested.
    expect(c.unfilledTypes).not.toContain("proof_element");
  });

  it("ignores unknown types in a selectedTypes override", () => {
    const c = composePatterns([pat("hook", 0.9)], {
      selectedTypes: ["hook", "not_a_real_type"],
    });
    expect(c.byType.hook).toBe(1);
    expect(c.unfilledTypes).toEqual([]);
  });
});

describe("composePatterns — usage integrity", () => {
  /*
   * The v2.1 bug: usage_count was incremented for every FETCHED row, including
   * rows never composed into the prompt. usage_count feeds the effectiveness
   * signal that all future compositions depend on, so inflating it on unused
   * rows corrupts the corpus permanently.
   */
  it("returns composedIds strictly narrower than the candidate pool", () => {
    const candidates = Array.from({ length: 100 }, () => pat("hook", 0.8));
    const c = composePatterns(candidates);
    expect(c.candidatesConsidered).toBe(100);
    expect(c.composedIds.length).toBe(TYPE_QUOTAS.hook);
    expect(c.composedIds.length).toBeLessThan(c.candidatesConsidered);
  });

  it("composedIds contains no duplicates", () => {
    const candidates = Object.keys(TYPE_QUOTAS).flatMap((t) =>
      Array.from({ length: 4 }, () => pat(t, 0.8))
    );
    const c = composePatterns(candidates);
    expect(new Set(c.composedIds).size).toBe(c.composedIds.length);
  });

  it("never composes the same pattern twice via both passes", () => {
    // A research-tagged pattern also qualifies globally; it must not double-count.
    const p = pat("proof_element", 0.9, {
      id: 42,
      tags: ["research_job_5"],
      sourceVideoId: "v",
    });
    const c = composePatterns([p], { researchJobId: 5, rankedVideoIds: ["v"] });
    expect(c.composedIds).toEqual([42]);
    expect(c.researchCount + c.globalCount).toBe(1);
  });
});

describe("sourceRankOf", () => {
  it("keeps composition stable when the ranked list is empty", () => {
    // Generation with no research job at all: every rank is null, and the sweep
    // must still produce a usable set rather than degrading to nothing.
    const c = composePatterns([pat("hook", 0.8), pat("proof_element", 0.7)], {
      researchJobId: null,
      rankedVideoIds: [],
    });
    expect(c.patterns.length).toBe(2);
    expect(c.researchCount).toBe(0);
  });

  it("returns the discovery index", () => {
    const p = pat("hook", 0.5, { sourceVideoId: "b" });
    expect(sourceRankOf(p, ["a", "b", "c"])).toBe(1);
  });

  it("returns null for a video outside the ranked list", () => {
    const p = pat("hook", 0.5, { sourceVideoId: "zzz" });
    expect(sourceRankOf(p, ["a", "b"])).toBeNull();
  });

  it("returns null when the pattern has no source video", () => {
    expect(sourceRankOf(pat("hook", 0.5), ["a"])).toBeNull();
  });
});

describe("describeComposition", () => {
  it("states research and global counts", () => {
    const c = composePatterns(
      [
        pat("hook", 0.5, { id: 1, tags: ["research_job_1"], sourceVideoId: "v" }),
        pat("proof_element", 0.8, { id: 2 }),
      ],
      { researchJobId: 1, rankedVideoIds: ["v"] }
    );
    const text = describeComposition(c);
    expect(text).toContain("1 from this topic's research");
    expect(text).toContain("1 from the global corpus");
  });

  it("names thin coverage instead of hiding it", () => {
    const c = composePatterns([pat("hook", 0.8)]);
    const text = describeComposition(c);
    expect(text).toContain("No grounding available for");
    expect(text).toContain("proof element");
  });

  it("says nothing about unfilled types when coverage is complete", () => {
    const candidates = Object.keys(TYPE_QUOTAS).flatMap((t) =>
      Array.from({ length: 5 }, () => pat(t, 0.9))
    );
    const text = describeComposition(composePatterns(candidates));
    expect(text).not.toContain("No grounding available");
  });
});
