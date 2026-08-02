/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PART 3D — AUTOMATIC PATTERN COMPOSITION
 *
 * The v2.1 generation panel exposed an 11-checkbox pattern-type grid, a minimum
 * effectiveness slider and a top-N-per-type slider. Three problems, all measured:
 *
 *   1. The operator was asked to make a decision they have no basis for. Nobody
 *      knows whether "objection_handler" should be checked for a given topic;
 *      the corpus knows, and the corpus is queryable.
 *   2. Unchecking every box disabled Generate with no explanation — a dead
 *      button with no error text (the old dead-button bug).
 *   3. The per-type loop issued one query per checked type and incremented
 *      usage_count on every fetched row, including rows that were never
 *      composed into the prompt (see USAGE INTEGRITY below).
 *
 * This module replaces the dials with a single deterministic composition step.
 * The server keeps the old parameters as optional API-level overrides — the idea
 * engine passes `selectedTypes` through invisibly — but the UI never sends them.
 *
 * ORDERING IS LOAD-BEARING: composition runs strictly AFTER research resolution.
 * Research-job-tagged patterns are weighted above global ones, so composing
 * before research resolves would make that weighting dead code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A pattern row as far as composition cares. Structural subset of content_patterns. */
export interface CompositionCandidate {
  id: number;
  patternType: string;
  patternText: string;
  patternContext: string | null;
  effectivenessScore: number | null;
  sourceVideoId: string | null;
  tags: string[] | null;
  usageCount?: number | null;
}

/**
 * Per-type quotas. These are the shape of a script, not a ranking.
 *
 * A 10-20 minute script needs ONE opening, so three hooks in the prompt is two
 * hooks of noise. It needs several proof elements because proof recurs per
 * teaching block. The quotas encode that asymmetry; without them the sweep
 * fills every slot with whatever type happens to be most plentiful in the
 * corpus, which is currently hooks by a wide margin (every research job mines
 * one hook reference per video).
 */
export const TYPE_QUOTAS: Record<string, number> = {
  hook: 2,
  pain_point: 2,
  proof_element: 3,
  transformation_arc: 2,
  cta: 1,
  objection_handler: 2,
  open_loop: 1,
  authority_signal: 1,
  social_proof: 1,
  story_structure: 1,
  key_phrase: 1,
};

/** Types worth composing at all, in priority order for the fallback sweep. */
export const COMPOSITION_TYPES = Object.keys(TYPE_QUOTAS);

/** Total prompt cap. Beyond ~15 patterns the model starts averaging them. */
export const MAX_COMPOSED = 15;

/** Global-sweep effectiveness floor. Research-tagged patterns bypass this. */
export const MIN_GLOBAL_EFFECTIVENESS = 0.4;

export interface ComposedPattern extends CompositionCandidate {
  /** Where this pattern earned its slot. */
  origin: "research" | "global";
  /** Discovery rank of the source video, when this came from a research job. */
  sourceRank: number | null;
}

export interface PatternComposition {
  patterns: ComposedPattern[];
  /** ids in composition order — the set whose usage_count may be incremented. */
  composedIds: number[];
  researchCount: number;
  globalCount: number;
  /**
   * Types whose quota the corpus could not fill. Reported to the operator
   * verbatim; a thin corpus is a fact about the corpus, not something to hide
   * by padding the prompt with off-type patterns.
   */
  unfilledTypes: string[];
  /** Per-type composed counts, for the disclosure and for tests. */
  byType: Record<string, number>;
  /** Total candidates considered — NOT the set whose usage is incremented. */
  candidatesConsidered: number;
}

/**
 * Rank of a research pattern's source video within the job's discovery order.
 *
 * Research patterns are tagged `research_job_<id>`; the hook references also
 * carry `hook_reference`. The job's `outlierVideos` array is stored in discovery
 * order (relevance-partitioned, then by outlier score), so position in that
 * array IS the rank. A pattern whose source video is not in the list gets null
 * and sorts after ranked ones rather than being dropped.
 */
export function sourceRankOf(
  candidate: CompositionCandidate,
  rankedVideoIds: string[]
): number | null {
  if (!candidate.sourceVideoId) return null;
  const i = rankedVideoIds.indexOf(candidate.sourceVideoId);
  return i >= 0 ? i : null;
}

/**
 * VARIANCE-PRESERVING EFFECTIVENESS.
 *
 * MEASURED PROBLEM. Mined research patterns were scored
 * `min(0.9, max(0.5, outlierScore / 10))`. vidIQ outlier scores for the health
 * niche are routinely 9-60+, so every score >= 9 clamped to the 0.9 ceiling:
 * 13 of 15 real rows landed on exactly 0.90. "Order by effectiveness" was
 * therefore sorting on a constant, and the tie-break was insertion order — i.e.
 * arbitrary. The spec asks composition to fill slots "by effectivenessScore",
 * which only means something if the score varies.
 *
 * FIX: log compression instead of linear division. log1p grows without bound but
 * slowly, so an outlier at 60 still scores above one at 12 while both stay
 * inside the band. Normalised against log1p(100) as a soft reference point, then
 * mapped into [0.45, 0.88]:
 *
 *   outlierScore   linear (old)   log (new)
 *              3          0.50        0.53
 *              9          0.90        0.65
 *             15          0.90        0.70
 *             30          0.90        0.77
 *             60          0.90        0.84
 *            120          0.90        0.90 (capped)
 *
 * The 0.88 practical ceiling is deliberate and unchanged in intent from the
 * original comment: competitor-sourced patterns must stay rankable BELOW the
 * operator's own proven analog data, which is inserted at 0.8-1.0 by
 * patternExtractorRouter. What changes is that competitors now differ from each
 * other instead of all pinning to one value.
 */
export function outlierEffectiveness(outlierScore: number | null | undefined): number {
  const s = Number(outlierScore);
  if (!Number.isFinite(s) || s <= 0) return 0.6; // unknown ≠ worst; matches prior default
  const normalized = Math.log1p(s) / Math.log1p(100);
  const scored = 0.45 + normalized * 0.45;
  return Math.round(Math.min(0.9, Math.max(0.45, scored)) * 1000) / 1000;
}

/**
 * Compose the pattern set for one generation.
 *
 * Single candidate fetch happens in the caller; this function is pure so the
 * quota behaviour is testable without a database.
 *
 * Order of operations:
 *   1. Research-tagged candidates first, sorted by source-video discovery rank
 *      then by effectiveness. These are the patterns mined from videos that are
 *      currently winning on THIS topic, so they outrank a globally strong
 *      pattern about something else.
 *   2. Global sweep fills remaining quota, effectiveness-ordered, floor 0.4.
 *   3. Both passes respect per-type quotas and the total cap.
 */
export function composePatterns(
  candidates: CompositionCandidate[],
  opts: {
    researchJobId?: number | null;
    /** Discovery-ordered source video ids from the research job. */
    rankedVideoIds?: string[];
    /** API-level override; when absent all COMPOSITION_TYPES are eligible. */
    selectedTypes?: string[] | null;
    minEffectiveness?: number;
    maxTotal?: number;
  } = {}
): PatternComposition {
  const {
    researchJobId = null,
    rankedVideoIds = [],
    selectedTypes = null,
    minEffectiveness = MIN_GLOBAL_EFFECTIVENESS,
    maxTotal = MAX_COMPOSED,
  } = opts;

  const eligibleTypes = (selectedTypes && selectedTypes.length > 0
    ? selectedTypes.filter((t) => t in TYPE_QUOTAS)
    : COMPOSITION_TYPES);

  const quotaLeft: Record<string, number> = {};
  for (const t of eligibleTypes) quotaLeft[t] = TYPE_QUOTAS[t] ?? 1;

  const researchTag = researchJobId != null ? `research_job_${researchJobId}` : null;
  const isResearch = (c: CompositionCandidate) =>
    researchTag != null && Array.isArray(c.tags) && c.tags.includes(researchTag);

  const composed: ComposedPattern[] = [];
  const takenIds = new Set<number>();
  const byType: Record<string, number> = {};

  const take = (c: CompositionCandidate, origin: "research" | "global", rank: number | null) => {
    composed.push({ ...c, origin, sourceRank: rank });
    takenIds.add(c.id);
    quotaLeft[c.patternType] = (quotaLeft[c.patternType] ?? 0) - 1;
    byType[c.patternType] = (byType[c.patternType] ?? 0) + 1;
  };

  const hasRoom = (c: CompositionCandidate) =>
    composed.length < maxTotal &&
    !takenIds.has(c.id) &&
    (quotaLeft[c.patternType] ?? 0) > 0;

  // ── Pass 1: research-tagged, by source-video discovery rank ────────────────
  //
  // No effectiveness floor here. A pattern mined from the #1 winning video on
  // this exact topic is the most relevant thing available even if the score
  // mapping rated it modestly; relevance to the topic beats a global average.
  const researchCandidates = candidates
    .filter((c) => isResearch(c) && eligibleTypes.includes(c.patternType))
    .map((c) => ({ c, rank: sourceRankOf(c, rankedVideoIds) }))
    .sort((a, b) => {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return (b.c.effectivenessScore ?? 0) - (a.c.effectivenessScore ?? 0);
    });

  for (const { c, rank } of researchCandidates) {
    if (!hasRoom(c)) continue;
    take(c, "research", rank);
  }
  const researchCount = composed.length;

  /*
   * ── Pass 2: QUOTA-AWARE global sweep ────────────────────────────────────
   *
   * The spec calls this out explicitly, and it is the subtle part: "a corpus
   * rich in weak hooks must not overfill the hook quota just because hooks are
   * plentiful."
   *
   * A naive sweep sorts every remaining candidate by effectiveness and walks
   * the list. With a corpus of 200 hooks at 0.55 and 4 proof elements at 0.85,
   * a naive sweep by effectiveness alone still respects the hook quota — but
   * only because a quota exists. The failure mode the spec names appears when
   * the sweep is written as "fill to maxTotal from the sorted list", which
   * silently ignores quotas once the research pass has left slots open.
   *
   * So the sweep is explicitly per-type: it walks types in priority order and
   * takes at most the REMAINING quota for each, rather than walking a flat
   * global list. Plentiful-but-weak types cannot cannibalise other types'
   * slots, and the total cap is applied on top.
   */
  const globalPool = candidates
    .filter(
      (c) =>
        !takenIds.has(c.id) &&
        eligibleTypes.includes(c.patternType) &&
        (c.effectivenessScore ?? 0) >= minEffectiveness
    )
    .sort((a, b) => {
      const d = (b.effectivenessScore ?? 0) - (a.effectivenessScore ?? 0);
      if (d !== 0) return d;
      // Deterministic tie-break, and it prefers the LESS used pattern so the
      // corpus rotates instead of hammering the same row into every script.
      const ua = a.usageCount ?? 0;
      const ub = b.usageCount ?? 0;
      if (ua !== ub) return ua - ub;
      return a.id - b.id;
    });

  for (const type of eligibleTypes) {
    if (composed.length >= maxTotal) break;
    for (const c of globalPool) {
      if (c.patternType !== type) continue;
      if (!hasRoom(c)) continue;
      take(c, "global", null);
    }
  }

  /*
   * UNFILLED TYPES. A type counts as unfilled when the corpus could not supply
   * even one pattern for it. Reporting "quota not fully met" for every type
   * would be noise — quotas are generous by design — but a type with ZERO
   * coverage means the prompt has no grounding for that beat at all, and the
   * operator should know which beats are ungrounded.
   *
   * Types skipped because the TOTAL cap was reached are excluded: that is the
   * cap working as intended, not thin coverage.
   */
  const capReached = composed.length >= maxTotal;
  const unfilledTypes = capReached
    ? []
    : eligibleTypes.filter((t) => (byType[t] ?? 0) === 0);

  return {
    patterns: composed,
    composedIds: composed.map((p) => p.id),
    researchCount,
    globalCount: composed.length - researchCount,
    unfilledTypes,
    byType,
    candidatesConsidered: candidates.length,
  };
}

/**
 * Human-readable grounding disclosure for the script detail panel.
 *
 * Deliberately states thin coverage rather than rounding it away: "12 patterns"
 * reads identically whether the corpus was rich or whether four beats had no
 * grounding at all, and those are very different scripts to trust.
 */
export function describeComposition(c: PatternComposition): string {
  const parts: string[] = [];
  parts.push(
    `${c.patterns.length} pattern${c.patterns.length === 1 ? "" : "s"} composed ` +
    `(${c.researchCount} from this topic's research, ${c.globalCount} from the global corpus)`
  );
  if (c.unfilledTypes.length > 0) {
    parts.push(
      `No grounding available for: ${c.unfilledTypes.map((t) => t.replace(/_/g, " ")).join(", ")}`
    );
  }
  return parts.join(". ") + ".";
}
