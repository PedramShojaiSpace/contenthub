/**
 * Script Factory Router — Phase E
 *
 * Generates corpus-grounded scripts with [VERIFIED] tags.
 *
 * How it works:
 * 1. Pull top-N patterns per requested type from content_patterns (by effectiveness score)
 * 2. Pull top-K semantically similar corpus entries via vector search
 * 3. Build a grounded prompt: inject verified patterns + corpus excerpts as context
 * 4. LLM generates the script, tagging each element it draws from the corpus as [VERIFIED]
 * 5. Count [VERIFIED] tags, compute verification %, save to script_factory_outputs
 * 6. Increment usage_count on all patterns used
 */

import { Supadata } from "@supadata/js";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { analogDataEntries, contentPatterns, corpusEntries, ideaFeedback, personas, researchJobs, scriptFactoryOutputs, scriptPerformanceFeedback, scripts, suggestedIdeas, videoJobs, ytTranscripts } from "../drizzle/schema";
/*
 * FINDING #10: research_jobs JSON columns are physically LONGTEXT, so the
 * driver returns STRINGS. `asArray()` guarantees a real array at runtime;
 * `as T[]` did not and produced the inArray SQL syntax error that silently
 * disabled research grounding. `hasItems()` guards inArray against empty/
 * non-array input.
 */
import { asArray, hasItems } from "../drizzle/longtextJson";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";
import {
  vidiqBalance,
  vidiqKeywordResearch,
  vidiqOutliers,
  vidiqTrendingVideos,
  spendableCredits,
  isVidIQToolError,
  type VidIQOutlierVideo,
} from "./vidiq";
import { getAvatarContextBlockForPersona } from "./avatarRouter";
import { searchCorpusEntries } from "./corpusRouter";
import { fetchTranscriptWithQuota } from "./transcriptRouter";
import { extractPatternsFromContent } from "./patternExtractorRouter";
import {
  extractOpening,
  classifyHookStructure,
  partitionByRelevance,
  MIN_TOPICAL_RELEVANCE,
  scoreTopicalRelevance,
  validateStructureSummary,
  buildHookReferenceBlock,
  buildStructureSummaryBlock,
  STRUCTURE_SUMMARY_PROMPT,
  MAX_HOOK_REFERENCES,
  type HookReference,
  type StructureSummary,
} from "./researchGrounding";
import {
  TITLE_PACKAGING_RULES,
  buildLengthInstruction,
  buildPackagingReferences,
  countWords,
  deriveSeedKeywords,
  isoWeekLabel,
  makeBatchId,
  normalizeKeyword,
  parseJsonColumn,
  safeJsonParse,
  wordBudget,
} from "./scriptFactoryHelpers";
// Part 3A — story integrity. The system previously invented a named patient with
// quoted dialogue inside content that sells a health offer; these helpers make
// that unrepresentable rather than merely discouraged.
import {
  STORY_MODES,
  type StoryMode,
  buildStoryIntegrityBlock,
  lintStoryIntegrity,
  formatViolations,
  countWordsWithStorySlots,
} from "./storyIntegrity";
// Part 3B — offer binding. A 15-minute script argued carefully for functional
// testing and then closed on a generic brand CTA, because the system had no
// concept of "the offer" and therefore could not name it.
import {
  type OfferProfile,
  buildOfferBlock,
  buildCtaOverrideBlock,
  parseStoredOfferLadder,
  selectOfferTier,
} from "./offerProfile";

// ─── Supadata helper ─────────────────────────────────────────────────────────

function getSupadata(): Supadata | null {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;
  return new Supadata({ apiKey });
}

/**
 * Fetch transcripts for the top N most-viewed YouTube videos relevant to a topic.
 * Returns an array of { title, transcript } objects (truncated to ~800 chars each).
 * Silently returns [] on any error so it never blocks script generation.
 */
async function fetchRelevantTranscripts(
  topic: string,
  maxVideos = 3
): Promise<{ title: string; transcript: string; viewCount: number }[]> {
  const supadata = getSupadata();
  if (!supadata) return [];

  try {
    // 1. Search for top relevant videos sorted by view count
    const searchResults = await supadata.youtube.search({
      query: topic,
      type: "video",
      limit: maxVideos + 2, // fetch a few extra in case some have no transcript
      sortBy: "views",
    });

    const videos = ((searchResults as any).results ?? [])
      .filter((r: any) => r.type === "video")
      .slice(0, maxVideos + 2)
      .map((v: any) => ({
        id: v.id as string,
        title: (v.title ?? "Untitled") as string,
        viewCount: (v.viewCount ?? 0) as number,
      }));

    if (videos.length === 0) return [];

    // 2. Fetch transcripts for each video (stop once we have maxVideos)
    const results: { title: string; transcript: string; viewCount: number }[] = [];

    for (const video of videos) {
      if (results.length >= maxVideos) break;
      try {
        const url = `https://www.youtube.com/watch?v=${video.id}`;
        const result = await supadata.transcript({ url, text: true });

        let text = "";
        if ("jobId" in result) {
          // Async job — poll briefly
          let jobResult: any = null;
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            jobResult = await supadata.transcript.getJobStatus((result as any).jobId);
            if (jobResult?.status === "completed" || jobResult?.status === "failed") break;
          }
          text = jobResult?.status === "completed" ? String(jobResult.content ?? "") : "";
        } else {
          text = String((result as any).content ?? "");
        }

        if (text.length > 100) {
          results.push({
            title: video.title,
            transcript: text.slice(0, 800),
            viewCount: video.viewCount,
          });
        }
      } catch {
        // Skip this video if transcript fetch fails
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCRIPT_FORMATS = [
  "youtube_script", "short_form", "email", "ad_copy", "sales_page_section", "podcast_outline",
] as const;

type ScriptFormat = typeof SCRIPT_FORMATS[number];

const FORMAT_DESCRIPTIONS: Record<ScriptFormat, string> = {
  youtube_script: "Full YouTube video script (8–15 min, hook + body + CTA, with timestamps)",
  short_form: "Short-form video script (60–90 sec, hook-first, TikTok/Reels/Shorts format)",
  email: "Email sequence message (subject line + body, 200–400 words, single CTA)",
  ad_copy: "Direct-response ad copy (headline + body + CTA, Facebook/YouTube ad format)",
  sales_page_section: "Sales page section (headline + subheadline + body + proof + CTA)",
  podcast_outline: "Podcast episode outline (intro hook + 4–6 talking points + outro CTA)",
};

// ─── Types ───────────────────────────────────────────────────────────────

export interface VideoIdea {
  topic: string;
  rationale: string;
  audienceAlignment: number;
  contentGap: string;
  recommendedFormat: string;
  recommendedPatterns: string[];
  analogDataSource: string;
  /**
   * v2: the live-research keyword behind this idea. Empty string when the idea
   * came purely from analog data. Optional so pre-v2 payloads still typecheck.
   */
  seedKeyword?: string;
}

export interface SuperchargedIdea extends VideoIdea {
  vidiq: {
    keyword: string;
    volume: number;
    competition: number;
    opportunityScore: number;
    estimatedMonthlySearch: number;
    topRelatedKeywords: { keyword: string; overall: number; volume: number }[];
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count [VERIFIED] tags in a script body.
 * Also counts total bracketed elements for verification %.
 */
export function countVerifiedTags(scriptBody: string): { verified: number; total: number; pct: number } {
  const verifiedMatches = scriptBody.match(/\[VERIFIED\]/g) ?? [];
  // Count all bracketed elements: [VERIFIED], [HOOK], [CTA], [PAIN], etc.
  const allBracketedMatches = scriptBody.match(/\[[A-Z_]+\]/g) ?? [];
  const verified = verifiedMatches.length;
  const total = allBracketedMatches.length;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  return { verified, total, pct };
}

/**
 * Build the grounded context block from patterns and corpus entries.
 */
function buildGroundedContext(
  patterns: { patternType: string; patternText: string; patternContext: string | null; effectivenessScore: number | null }[],
  corpusExcerpts: { title: string | null; content: string; sourceType: string }[],
  externalTranscripts: { title: string; transcript: string; viewCount: number }[] = [],
  /** Operator-selected analog entries (Phase 2.3.1) — the explicit Northstar. */
  explicitNorthStar: { title: string | null; content: string; type: string | null }[] = [],
  /** Competitive research block from a deep research job (Phase 3.5). */
  researchContext = ""
): string {
  const lines: string[] = [];

  lines.push("=== VERIFIED PATTERNS FROM HIGH-PERFORMING CONTENT ===");
  lines.push("These patterns are extracted from content that has proven to convert or perform above baseline.");
  lines.push("When you use one of these patterns verbatim or near-verbatim, tag it with [VERIFIED].");
  lines.push("");

  const byType: Record<string, typeof patterns> = {};
  for (const p of patterns) {
    if (!byType[p.patternType]) byType[p.patternType] = [];
    byType[p.patternType].push(p);
  }

  for (const [type, typePatterns] of Object.entries(byType)) {
    lines.push(`--- ${type.toUpperCase().replace(/_/g, " ")} ---`);
    for (const p of typePatterns.slice(0, 3)) {
      const eff = p.effectivenessScore != null ? ` (eff: ${(p.effectivenessScore * 100).toFixed(0)}%)` : "";
      lines.push(`• "${p.patternText}"${eff}`);
      if (p.patternContext) lines.push(`  Context: ${p.patternContext}`);
    }
    lines.push("");
  }

  // Operator-chosen North Star entries outrank everything retrieved automatically.
  // They get far more room (2500 chars vs 1000) because the whole point of an
  // explicit pick is that this specific document is the model to follow.
  if (explicitNorthStar.length > 0) {
    lines.push("=== ANALOG DATA — NORTHSTAR (OPERATOR-SELECTED, HIGHEST PRIORITY) ===");
    lines.push("The operator hand-picked these entries as the model for THIS script.");
    lines.push("They outrank every other source below, including anything retrieved automatically.");
    lines.push("Mirror their structure, cadence, objection handling, and selling logic.");
    lines.push("Use their exact language wherever it fits, and tag it [VERIFIED] when you do.");
    lines.push("");
    for (const entry of explicitNorthStar.slice(0, 5)) {
      const typeLabel = (entry.type ?? "analog_data").toUpperCase().replace(/_/g, " ");
      lines.push(`[NORTHSTAR — ${typeLabel}] ${entry.title ?? "Untitled"}`);
      lines.push(entry.content.slice(0, 2500));
      lines.push("");
    }
  }

  if (corpusExcerpts.length > 0) {
    // Sort: analog_data (Northstar) first, transcripts second
    const analogEntries = corpusExcerpts.filter(e => e.sourceType === "analog_data");
    const transcriptEntries = corpusExcerpts.filter(e => e.sourceType !== "analog_data");

    // When the operator already supplied the Northstar, retrieved analog entries
    // drop to supporting evidence so the two blocks cannot compete for primacy.
    if (analogEntries.length > 0 && explicitNorthStar.length > 0) {
      lines.push("=== ADDITIONAL ANALOG DATA (SUPPORTING — subordinate to the selected Northstar) ===");
      lines.push("");
      for (const entry of analogEntries.slice(0, 3)) {
        lines.push(`[${entry.sourceType.toUpperCase()}] ${entry.title ?? "Untitled"}`);
        lines.push(entry.content.slice(0, 1000));
        lines.push("");
      }
    } else if (analogEntries.length > 0) {
      lines.push("=== ANALOG DATA — NORTHSTAR (PROVEN CONVERTING CONTENT) ===");
      lines.push("PRIORITY: These are sales pages, ads, and interviews that have ALREADY converted customers.");
      lines.push("Use the exact language, hooks, and framing from these entries. This is your primary source.");
      lines.push("");
      for (const entry of analogEntries.slice(0, 3)) {
        lines.push(`[${entry.sourceType.toUpperCase()}] ${entry.title ?? "Untitled"}`);
        lines.push(entry.content.slice(0, 1000));
        lines.push("");
      }
    }

    if (transcriptEntries.length > 0) {
      lines.push("=== SECONDARY REFERENCE — YOUTUBE TRANSCRIPTS ===");
      lines.push("SECONDARY: Use these for context and topic familiarity ONLY.");
      lines.push("Do NOT let these override the analog data above. They are supporting context, not the Northstar.");
      lines.push("");
      for (const entry of transcriptEntries.slice(0, 2)) {
        lines.push(`[TRANSCRIPT] ${entry.title ?? "Untitled"}`);
        lines.push(entry.content.slice(0, 500));
        lines.push("");
      }
    }
  }

  // External YouTube transcripts (Supadata — most popular relevant videos)
  if (externalTranscripts.length > 0) {
    lines.push("=== YOUTUBE RESEARCH — TOP RELEVANT VIDEOS (SUPADATA) ===");
    lines.push("TERTIARY: These are transcripts from the most-viewed YouTube videos on this topic.");
    lines.push("Use them to understand what angles are already covered and what language resonates.");
    lines.push("Do NOT copy these verbatim. Use them for research context only.");
    lines.push("The analog data above is ALWAYS the Northstar — these are supplementary research.");
    lines.push("");
    for (const t of externalTranscripts) {
      const views = t.viewCount > 0 ? ` (${(t.viewCount / 1000).toFixed(0)}K views)` : "";
      lines.push(`[YOUTUBE RESEARCH] ${t.title}${views}`);
      lines.push(t.transcript);
      lines.push("");
    }
  }

  // Competitive research sits LAST on purpose: it is the least authoritative
  // input, and appearing after the Northstar reinforces that ordering.
  if (researchContext) {
    lines.push(researchContext);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Deep Research helpers (Phase 3) ───────────────────────────────────

/** Outlier row as stored on `research_jobs.outlierVideos`. */
interface StoredOutlier {
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string;
  views: number;
  subscriberCount: number | null;
  outlierScore: number;
  publishedAt: string | null;
}

/**
 * Build the competitive research block injected into script generation.
 *
 * Deliberately framed as intelligence to BEAT, not material to copy: the
 * operator's own analog data remains the Northstar (Phase 3.5).
 */
function buildResearchContext(
  outliers: StoredOutlier[],
  transcripts: { title: string; text: string }[]
): string {
  if (outliers.length === 0 && transcripts.length === 0) return "";

  const lines: string[] = [];
  lines.push("=== COMPETITIVE RESEARCH — WINNING VIDEOS FOR THIS TOPIC ===");
  lines.push("These videos are ALREADY overperforming on this exact topic.");
  lines.push("Study what makes them work: the hook angle, the promise, the structure, the pacing.");
  lines.push("Your job is to BEAT them — not to copy them.");
  lines.push("The operator's analog data above remains the Northstar for voice, offer, and CTA.");
  lines.push("");

  if (outliers.length > 0) {
    lines.push("--- OVERPERFORMING TITLES (ranked) ---");
    for (const o of outliers.slice(0, 10)) {
      const views = o.views > 0 ? `${(o.views / 1000).toFixed(0)}K views` : "views n/a";
      const score = o.outlierScore ? `, outlier ${o.outlierScore.toFixed(1)}x` : "";
      lines.push(`• "${o.title}" — ${o.channelTitle} (${views}${score})`);
    }
    lines.push("");
  }

  if (transcripts.length > 0) {
    lines.push("--- TRANSCRIPTS OF THE TOP PERFORMERS ---");
    lines.push("Use these to see HOW they open, hold attention, and structure the teach.");
    lines.push("Do NOT lift their language — the Northstar analog data owns the voice.");
    lines.push("");
    for (const t of transcripts.slice(0, 5)) {
      lines.push(`[COMPETITOR TRANSCRIPT] ${t.title}`);
      // 6000 chars keeps roughly the first half of a 10-minute video, which is
      // where hook and structure live, without blowing the context window.
      lines.push(t.text.slice(0, 6000));
      lines.push("");
    }
  }

  lines.push("=== END COMPETITIVE RESEARCH ===");
  return lines.join("\n");
}

/** What `generate` needs back from a research job to build its prompt. */
interface ResolvedResearch {
  jobId: number | null;
  context: string;
  patternIds: number[];
  outlierCount: number;
  transcriptCount: number;
  /**
   * v2.2 Part 3C — grounding blocks built from this job.
   *
   * Kept separate from `context` so generate can report which specific kinds of
   * grounding a script actually received, instead of a single opaque boolean.
   */
  hookBlock: string;
  structureBlock: string;
  hookReferenceCount: number;
  hasStructureSummary: boolean;
  /**
   * v2.2 Part 3C — WHAT the grounding was, not merely THAT there was some.
   *
   * Measured problem: a run seeded with nonsense reported `researchGrounded:
   * true` because grounding text did reach the prompt — but the text was a
   * Hindi/Urdu television drama transcript. A boolean that says "grounded"
   * without saying "grounded in what" is the same dishonest metric this build
   * exists to remove, so the source titles and the on-topic ratio travel with
   * the flag and the operator can judge the grounding for himself.
   */
  groundingSources: string[];
  onTopicRatio: string | null;
  /**
   * Set when RESOLUTION itself threw (finding #10 class: a completed research
   * job whose grounding could not be read back). Distinct from "no research
   * requested" and from "research failed" -- those leave this null. Generation
   * still proceeds ungrounded, but the operator must be told why.
   */
  resolutionError?: string | null;
}

const EMPTY_RESEARCH: ResolvedResearch = {
  jobId: null,
  context: "",
  patternIds: [],
  outlierCount: 0,
  transcriptCount: 0,
  hookBlock: "",
  structureBlock: "",
  hookReferenceCount: 0,
  hasStructureSummary: false,
  resolutionError: null,
  groundingSources: [],
  onTopicRatio: null,
};

/**
 * Resolve the research job to use for a generation run.
 *
 * Either an explicit `researchJobId`, or — when `useDeepResearch` is set — the
 * most recent complete job for the same topic. Never throws: research is an
 * enhancement, so a missing or broken job degrades to ungrounded-by-research
 * generation rather than failing the request.
 */
async function resolveResearchContext(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  opts: { useDeepResearch: boolean; researchJobId?: number; topic: string }
): Promise<ResolvedResearch> {
  if (!opts.researchJobId && !opts.useDeepResearch) return EMPTY_RESEARCH;

  try {
    let job: typeof researchJobs.$inferSelect | undefined;

    if (opts.researchJobId) {
      const rows = await db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.id, opts.researchJobId))
        .limit(1);
      job = rows[0];
    } else {
      const rows = await db
        .select()
        .from(researchJobs)
        .where(and(eq(researchJobs.topic, opts.topic.slice(0, 500)), eq(researchJobs.status, "complete")))
        .orderBy(desc(researchJobs.createdAt))
        .limit(1);
      job = rows[0];
    }

    if (!job) return EMPTY_RESEARCH;

    const outliers = asArray<StoredOutlier>(job.outlierVideos);
    const videoIds = asArray<string>(job.transcriptVideoIds);

    // Transcripts are read back from the cache the job populated, so no
    // additional Supadata units are ever spent at generation time.
    let transcripts: { title: string; text: string }[] = [];
    if (hasItems<string>(videoIds)) {
      const rows = await db
        .select({
          videoId: ytTranscripts.videoId,
          videoTitle: ytTranscripts.videoTitle,
          rawText: ytTranscripts.rawText,
        })
        .from(ytTranscripts)
        .where(and(inArray(ytTranscripts.videoId, videoIds), eq(ytTranscripts.status, "fetched")));

      transcripts = rows
        .filter((r) => Boolean(r.rawText))
        .map((r) => ({
          title: r.videoTitle
            ?? outliers.find((o) => o.videoId === r.videoId)?.title
            ?? r.videoId,
          text: r.rawText as string,
        }));
    }

    // v2.2 Part 3C — HOOK REFERENCES.
    //
    // Read back the `hook_reference`-tagged rows this job wrote. These are whole
    // openings to analyse for STRUCTURE, explicitly not phrases to reuse, which
    // is why they are fetched separately from mined patterns rather than being
    // mixed into the same list.
    let hookRefs: HookReference[] = [];
    try {
      const jobPatternIds = asArray<number>(job.patternIds);
      if (hasItems<number>(jobPatternIds)) {
        const rows = await db
          .select({
            patternText: contentPatterns.patternText,
            patternContext: contentPatterns.patternContext,
            sourceVideoId: contentPatterns.sourceVideoId,
            effectivenessScore: contentPatterns.effectivenessScore,
          })
          .from(contentPatterns)
          .where(inArray(contentPatterns.id, jobPatternIds));

        hookRefs = rows
          .filter((r) => (r.patternContext ?? "").startsWith("HOOK REFERENCE"))
          .map((r) => {
            const ctx = r.patternContext ?? "";
            const label = /structure=([a-z_]+)/.exec(ctx)?.[1] ?? "unlabeled";
            const title = /video="([^"]*)"/.exec(ctx)?.[1] ?? r.sourceVideoId ?? "";
            const views = outliers.find((o) => o.videoId === r.sourceVideoId)?.views ?? 0;
            return {
              videoId: r.sourceVideoId ?? "",
              title,
              openingText: r.patternText,
              structureLabel: label as HookReference["structureLabel"],
              views,
            };
          })
          .sort((a, b) => b.views - a.views)
          .slice(0, MAX_HOOK_REFERENCES);
      }
    } catch (err) {
      // Grounding is an enhancement; never fail generation over it.
      console.error("[ScriptFactory] hook reference load failed:", err);
    }

    /*
     * `structureSummary` now arrives already parsed via longtextJson(), so this
     * is a plain null-check rather than the `as` cast that hid finding #10.
     */
    const summary = (job.structureSummary ?? null) as StructureSummary | null;

    return {
      jobId: job.id,
      context: buildResearchContext(outliers, transcripts),
      patternIds: asArray<number>(job.patternIds),
      outlierCount: outliers.length,
      transcriptCount: transcripts.length,
      hookBlock: hookRefs.length > 0 ? buildHookReferenceBlock(hookRefs) : "",
      structureBlock: summary ? buildStructureSummaryBlock(summary) : "",
      hookReferenceCount: hookRefs.length,
      hasStructureSummary: summary !== null,
      /*
       * Titles of the videos whose transcripts actually became grounding text.
       * This is what makes "grounded" auditable: if the operator sees a TV
       * drama or a gaming video in this list, the badge is worthless and he can
       * see that at a glance instead of trusting a green checkmark.
       */
      groundingSources: transcripts.map((t) => t.title ?? "Untitled").slice(0, 6),
      // Recorded by the pipeline into notes as `on_topic=N/M`.
      onTopicRatio: /on_topic=(\d+\/\d+)/.exec(job.notes ?? "")?.[1] ?? null,
    };
  } catch (err) {
    /*
     * DISCLOSURE GAP FIX (finding #10 second half).
     *
     * This catch previously returned EMPTY_RESEARCH silently. Because the
     * failure happened during RESOLUTION rather than during RESEARCH, the
     * generate response reported `researchFailureReason: null` and the operator
     * saw an ordinary ungrounded script — while vidIQ credits and Supadata units
     * had already been spent. Failing open is fine; failing open INVISIBLY is
     * the dishonest-metric class this build exists to remove. The reason is now
     * carried out so the caller can surface it.
     */
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[ScriptFactory] resolveResearchContext failed:", err);
    return { ...EMPTY_RESEARCH, resolutionError: reason };
  }
}

/**
 * Persona context injected into the system prompt (Phase 2.3.3).
 *
 * `audienceLine` replaces the hardcoded demographic sentence when a persona is
 * selected; `block` carries the full targeting brief. Both are empty strings
 * when no persona was chosen, so the prompt is byte-identical to before.
 */
interface PersonaContext {
  audienceLine: string;
  block: string;
  ctaCopy: string | null;
  name: string;
}

/**
 * Build the `=== TARGET PERSONA ===` block from a `personas` row.
 *
 * The persona list columns are JSON-in-TEXT, so every one is parsed defensively:
 * a hand-edited persona must never be able to break script generation.
 */
function buildPersonaBlock(
  persona: typeof personas.$inferSelect,
  avatarBlock: string
): PersonaContext {
  const painPoints = safeJsonParse<string[]>(persona.painPoints) ?? [];
  const aspirations = safeJsonParse<string[]>(persona.aspirations) ?? [];
  const topQuestions = safeJsonParse<string[]>(persona.topQuestions) ?? [];

  const lines: string[] = [];
  lines.push("=== TARGET PERSONA ===");
  lines.push(`You are writing for ONE person: ${persona.name}.`);
  if (persona.description) lines.push(`Who they are: ${persona.description}`);

  if (painPoints.length > 0) {
    lines.push("");
    lines.push("What keeps them up at night (speak to these directly):");
    for (const p of painPoints.slice(0, 8)) lines.push(`- ${p}`);
  }

  if (aspirations.length > 0) {
    lines.push("");
    lines.push("What they actually want (paint this outcome):");
    for (const a of aspirations.slice(0, 8)) lines.push(`- ${a}`);
  }

  if (topQuestions.length > 0) {
    lines.push("");
    lines.push("Questions they are already asking (answer these in the script):");
    for (const q of topQuestions.slice(0, 8)) lines.push(`- ${q}`);
  }

  if (persona.ctaCopy) {
    lines.push("");
    lines.push("PROVEN CTA COPY FOR THIS PERSONA (the [CTA] section MUST be built on this,");
    lines.push("adapted to fit the script's flow — do not invent a different offer or ask):");
    lines.push(persona.ctaCopy);
  }

  if (persona.landingPageUrl) {
    lines.push("");
    lines.push(`Destination for the CTA: ${persona.landingPageUrl}`);
  }

  lines.push("=== END TARGET PERSONA ===");

  // The avatar intelligence block is supplemental real-call evidence about this
  // same persona; it already carries its own delimiters.
  const block = avatarBlock
    ? `${lines.join("\n")}\n\n${avatarBlock}`
    : lines.join("\n");

  const descriptor = persona.description
    ? `${persona.name} — ${persona.description}`
    : persona.name;

  return {
    audienceLine: `Audience: ${descriptor}`,
    block,
    ctaCopy: persona.ctaCopy ?? null,
    name: persona.name,
  };
}

/**
 * Build the script generation system prompt.
 *
 * `opts` is optional so every existing caller and test keeps working unchanged.
 */
function buildSystemPrompt(
  format: ScriptFormat,
  groundedContext: string,
  opts: {
    persona?: PersonaContext | null;
    lengthInstruction?: string;
    /** Part 3A. Defaults to the safest mode so an omitted arg cannot fabricate. */
    storyMode?: StoryMode;
    /**
     * Part 3B. A validated profile, or null. Null omits the offer block entirely
     * rather than binding the CTA to a guessed offer.
     */
    offerProfile?: OfferProfile | null;
    /** Part 3B. The operator's own close. REPLACES offer binding, never coexists. */
    ctaOverride?: string | null;
    /**
     * Part 3C. Openings of real videos that already won on this topic, presented
     * for STRUCTURAL analysis. Empty string when no research grounding exists —
     * an ungrounded run must not receive scaffolding that implies it had research.
     */
    hookBlock?: string;
    /** Part 3C. Aggregate structural analysis across the researched transcripts. */
    structureBlock?: string;
  } = {}
): string {
  const {
    persona,
    lengthInstruction,
    storyMode = "brief",
    offerProfile = null,
    ctaOverride = null,
    hookBlock = "",
    structureBlock = "",
  } = opts;
  // Part 3B — mutually exclusive by construction. Two competing closes make the
  // script argue with itself for fifteen minutes, so an override wins outright
  // and the offer block is not emitted alongside it.
  const offerSection = ctaOverride && ctaOverride.trim()
    ? "\n" + buildCtaOverrideBlock(ctaOverride) + "\n"
    : offerProfile
      ? "\n" + buildOfferBlock(offerProfile) + "\n"
      : "";

  // Default demographic line, replaced wholesale when a persona is selected.
  const audienceLine = persona?.audienceLine
    ?? "Audience: health-conscious\nprofessionals aged 35-55 who are high-achievers but feel something is missing.";

  const personaSection = persona?.block ? `\n${persona.block}\n` : "";
  const lengthSection = lengthInstruction ? `\n${lengthInstruction}\n` : "";

  // Part 3C — structural grounding sections. Emitted only when research
  // actually produced them, so their presence in the prompt is itself evidence.
  const hookSection = hookBlock ? `\n${hookBlock}\n` : "";
  const structureSection = structureBlock ? `\n${structureBlock}\n` : "";

  // The CTA rule only hardens when we actually have proven copy to anchor on.
  const ctaRule = persona?.ctaCopy
    ? "\n- The [CTA] section MUST be anchored on the PROVEN CTA COPY in the TARGET PERSONA block above."
    : "";

  return `You are a direct-response copywriter for Dr. Pedram Shojai (The Urban Monk).
Your job is to write a ${FORMAT_DESCRIPTIONS[format]} that is grounded in proven, converting content.

VOICE: Dr. Pedram Shojai's voice — bridges ancient wisdom with modern science, challenges the status quo,
empathetic but direct, authoritative, personal storytelling, never preachy. ${audienceLine}
${personaSection}${lengthSection}
=== NORTHSTAR RULE — READ THIS FIRST ===
The ANALOG DATA below (sales pages, ads, interviews, surveys) is your PRIMARY source of truth.
It represents PROVEN, CONVERTING content — language that has already moved real customers to buy.
You MUST anchor every structural element (hook, pain, proof, CTA) to the analog data first.

Do NOT invent topics, trends, or angles from general knowledge.
Do NOT follow YouTube rabbit holes or generic health content patterns.
Do NOT use language that isn't grounded in the provided corpus.

The analog data is the Northstar. Stay close to it. The script should feel like it was written
by someone who deeply studied what already converts for this specific audience — because it was.
=== END NORTHSTAR RULE ===

VERIFIED TAGGING RULES (CRITICAL):
- When you use a pattern or phrase from the VERIFIED PATTERNS section verbatim or near-verbatim, 
  immediately follow it with [VERIFIED]
- When you use a structural element from the CORPUS REFERENCE EXCERPTS, tag the sentence with [VERIFIED]
- Do NOT tag elements you invented — only tag elements drawn from the provided corpus
- Aim for at least 40% [VERIFIED] coverage of key structural elements
- Format: "Your hook text here [VERIFIED]" — the tag goes AFTER the element, inline

${buildStoryIntegrityBlock(storyMode)}
${offerSection}${hookSection}${structureSection}

SCRIPT STRUCTURE TAGS (use these to label each section):
[HOOK] — opening hook (first 15 seconds / first line)
[PAIN] — pain point identification
[PROOF] — proof element or authority signal
[STORY] — story or transformation arc (obey STORY INTEGRITY above)
[TEACH] — teaching point or key insight
[OBJECTION] — objection handler
[CTA] — call to action
[CLOSE] — closing

OUTPUT FORMAT:
- Use the structure tags above to label each section
- After each structure tag, write the content for that section
- [VERIFIED] tags go inline after verified phrases, not on their own line
- Write clean, publishable copy — no meta-commentary, no "Here's your script:", no explanations
- Start directly with [HOOK]${ctaRule}

${groundedContext}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * PART 3C — SHARED DEEP RESEARCH PIPELINE.
 *
 * Extracted verbatim from the `runDeepResearch` mutation body so that the tRPC
 * procedure and `generate`'s auto-research path run the SAME code. Two copies of
 * a pipeline that writes research_jobs, yt_transcripts and content_patterns
 * would drift, and the drift would be invisible until the two produced
 * different grounding for the same seed.
 *
 * Returns a result object rather than throwing for expected failure modes; only
 * genuinely unexpected errors propagate. `generate` needs to continue on
 * research failure (fail-open), so a thrown error there would be a regression.
 */
export interface DeepResearchOpts {
  topic: string;
  seedKeyword?: string;
  maxTranscripts?: number;
}

export interface DeepResearchResult {
  jobId: number;
  status: "complete" | "failed";
  outlierCount: number;
  transcriptsFetched: number;
  transcriptsCached: number;
  transcriptsFailed: number;
  quotaBlocked: boolean;
  patternCount: number;
  error: string | null;
  /** Hook reference pattern ids (3C) */
  hookPatternIds?: number[];
  /** How many discovery results were dropped as off-topic (3C) */
  offTopicDropped?: number;
  discoverySource?: string;
  structureSummarySaved?: boolean;
}

export async function executeDeepResearch(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  opts: DeepResearchOpts
): Promise<DeepResearchResult> {
  const seedKeyword = (opts.seedKeyword && normalizeKeyword(opts.seedKeyword))
    || normalizeKeyword(opts.topic);

  const jobInsert = await db.insert(researchJobs).values({
    topic: opts.topic.slice(0, 500),
    seedKeyword: seedKeyword.slice(0, 255),
    status: "pending",
  });
  const jobId = Number(
    (jobInsert as any)[0]?.insertId ?? (jobInsert as any).insertId ?? 0
  );
  if (!jobId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create research job" });
  }

  /** Stage marker so a poll always reflects real progress. */
  const setStatus = async (
    status: typeof researchJobs.$inferSelect["status"],
    extra: Partial<typeof researchJobs.$inferInsert> = {}
  ) => {
    await db
      .update(researchJobs)
      .set({ status, updatedAt: sql`NOW()`, ...extra })
      .where(eq(researchJobs.id, jobId));
  };

  try {
    // ── 1. Discover overperforming videos ──────────────────────────────
    await setStatus("researching_outliers");

    let rawOutliers: VidIQOutlierVideo[] = [];
    let discoverySource = "vidiq_outliers";
    try {
      rawOutliers = await vidiqOutliers(seedKeyword, 10);
    } catch (err) {
      console.error("[DeepResearch] vidiqOutliers failed:", err);
      rawOutliers = [];
    }

    // Fallback: the outlier tool is topic-sensitive and can come back empty
    // for narrow keywords, where trending still gives usable competitors.
    if (rawOutliers.length === 0) {
      try {
        const trending = await vidiqTrendingVideos(seedKeyword, 10);
        rawOutliers = trending as unknown as VidIQOutlierVideo[];
        discoverySource = "vidiq_trending_fallback";
      } catch (err) {
        console.error("[DeepResearch] vidiqTrendingVideos fallback failed:", err);
      }
    }

    // Rank by outlier score first, then raw views.
    //
    // v2.2 Part 1 fix 9: vidiqOutliers/vidiqTrendingVideos now normalise the
    // wire shape themselves, so `title`, `channelId`, `subscriberCount` and
    // `publishedAt` are real values here. The previous comment claimed
    // channelId and subscriberCount were "absent from VidIQ's payload" and
    // hardcoded both to null — they are in fact present. They were reading
    // as undefined only because the whole object was being mis-mapped.
    const outlierVideos: StoredOutlier[] = rawOutliers
      .filter((v) => v && v.videoId)
      .map((v) => ({
        videoId: v.videoId,
        title: v.title,
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        views: v.viewCount,
        subscriberCount: v.subscriberCount,
        outlierScore: v.outlierScore,
        publishedAt: v.publishedAt,
      }))
      .sort((a, b) => (b.outlierScore - a.outlierScore) || (b.views - a.views));

    // v2.2 Part 3C — TOPICAL RELEVANCE GATE.
    //
    // Measured problem (docs/build-reports/v22r/proof_discovery_sources.txt):
    // `vidiq_outliers` returned on-topic results for only 8/15 health keywords.
    // A live run on "leaky gut fatigue" mined patterns from a Sprunki gaming
    // video and a Corpus Christi water-supply report, storing lines like
    // "Mhm, good tasty." at effectiveness 0.9 — the ceiling. Those rows then
    // become the grounding corpus every later composition draws from, so
    // off-topic research is worse than no research: it launders noise into the
    // system with high confidence.
    //
    // Relevant results are preferred; off-topic ones are kept as a TAIL rather
    // than deleted, so a seed where nothing matches still has something to work
    // with instead of hard-failing. The counts are reported either way.
    const { relevant: onTopic, offTopic } = partitionByRelevance(seedKeyword, outlierVideos);
    const rankedVideos: StoredOutlier[] = [...onTopic, ...offTopic];
    const offTopicDropped = offTopic.length;
    if (offTopicDropped > 0) {
      console.log(
        `[DeepResearch] ${onTopic.length}/${outlierVideos.length} discovery results are on-topic for "${seedKeyword}"; ` +
        `${offTopicDropped} deprioritised: ${offTopic.slice(0, 3).map((v) => JSON.stringify(v.title)).join(", ")}`
      );
    }

    /*
     * HARD GATE (v2.2 Part 3C). Deprioritising is not enough on its own.
     * Measured: the nonsense seed "qwzxjkvbnm zzzqqq" scored on_topic=0/10 and
     * the job still COMPLETED, writing 10 patterns mined from unrelated videos
     * into content_patterns at effectiveness 0.9. Those rows are permanent and
     * every later composition draws from them, so a seed that matches NOTHING
     * must fail loudly rather than silently poison the corpus.
     *
     * The gate is deliberately narrow: it fires only when literally zero results
     * clear MIN_TOPICAL_RELEVANCE. A single weak match is enough to proceed,
     * because the scorer is a keyword-overlap noise filter, not a semantic
     * ranker, and over-blocking real research costs more than a marginal video.
     */
    if (outlierVideos.length > 0 && onTopic.length === 0) {
      const gateMsg =
        `No discovery result was topically relevant to "${seedKeyword}". ` +
        `${outlierVideos.length} videos returned; all scored below the relevance ` +
        `floor (${MIN_TOPICAL_RELEVANCE}). e.g. ` +
        offTopic.slice(0, 3).map((v) => JSON.stringify(v.title)).join(", ") +
        `. Refusing to mine patterns from unrelated videos — try a more specific seed keyword.`;
      await setStatus("failed", {
        outlierVideos,
        errorMessage: gateMsg.slice(0, 512),
      });
      return {
        jobId,
        status: "failed" as const,
        outlierCount: outlierVideos.length,
        transcriptsFetched: 0,
        transcriptsCached: 0,
        transcriptsFailed: 0,
        quotaBlocked: false,
        patternCount: 0,
        error: gateMsg,
        offTopicDropped,
      };
    }

    if (outlierVideos.length === 0) {
      // Nothing to research is a failure, but a clean, explained one.
      await setStatus("failed", {
        outlierVideos: [],
        errorMessage: "No outlier or trending videos found for this keyword",
        notes: `discovery=${discoverySource}; seed="${seedKeyword}"`,
      });
      return {
        jobId,
        status: "failed" as const,
        outlierCount: 0,
        transcriptsFetched: 0,
        transcriptsCached: 0,
        transcriptsFailed: 0,
        quotaBlocked: false,
        patternCount: 0,
        error: "No outlier or trending videos found for this keyword",
      };
    }

    await setStatus("fetching_transcripts", { outlierVideos });

    // ── 2. Secure transcripts through the shared quota ledger ──────────
    const secured: { videoId: string; title: string; text: string }[] = [];
    let transcriptsFetched = 0;
    let transcriptsCached = 0;
    let transcriptsFailed = 0;
    let quotaBlocked = false;

    for (const video of rankedVideos.slice(0, (opts.maxTranscripts ?? 3))) {
      const result = await fetchTranscriptWithQuota(db, {
        videoId: video.videoId,
        videoTitle: video.title,
        publishedAt: video.publishedAt ?? undefined,
      });

      if (result.outcome === "quota_blocked") {
        // Respect the cap: stop trying rather than burning failed calls.
        quotaBlocked = true;
        break;
      }
      if (result.outcome === "cached") {
        transcriptsCached++;
        if (result.text) secured.push({ videoId: video.videoId, title: video.title, text: result.text });
      } else if (result.outcome === "fetched") {
        transcriptsFetched++;
        if (result.text) secured.push({ videoId: video.videoId, title: video.title, text: result.text });
      } else {
        transcriptsFailed++;
      }
    }

    const transcriptVideoIds = secured.map((s) => s.videoId);

    // ── 3. Mine patterns from the secured transcripts ──────────────────
    await setStatus("extracting_patterns", {
      transcriptVideoIds,
      transcriptsFetched,
      transcriptsCached,
      transcriptsFailed,
      quotaBlocked,
    });

    const patternIds: number[] = [];
    for (const item of secured) {
      try {
        const extracted = await extractPatternsFromContent(item.text, item.title);
        // Top 5 per video keeps the pattern table signal-dense.
        for (const p of extracted.slice(0, 5)) {
          const outlier = outlierVideos.find((o) => o.videoId === item.videoId);
          // Normalize the outlier score into the 0-1 effectiveness band this
          // table uses; competitor-sourced patterns cap at 0.9 so the
          // operator's own proven analog data can still outrank them.
          const effectiveness = outlier?.outlierScore
            ? Math.min(0.9, Math.max(0.5, outlier.outlierScore / 10))
            : 0.6;

          const patternInsert = await db.insert(contentPatterns).values({
            sourceVideoId: item.videoId,
            patternType: p.type as any,
            patternText: p.text,
            patternContext: p.context ?? null,
            effectivenessScore: effectiveness,
            tags: [`research_job_${jobId}`, "competitor_research"],
          });
          const pid = Number(
            (patternInsert as any)[0]?.insertId ?? (patternInsert as any).insertId ?? 0
          );
          if (pid) patternIds.push(pid);
        }
      } catch (err) {
        // One unmineable transcript must not sink the whole job.
        console.error(`[DeepResearch] pattern extraction failed for ${item.videoId}:`, err);
      }
    }

    // ── 4. HOOK REFERENCES (v2.2 Part 3C) ──────────────────────────────
    //
    // Each secured transcript's opening ~200 words is stored as its own
    // content_patterns row of type "hook". These are what let generation
    // imitate the STRUCTURE of openings that already won on this topic while
    // writing entirely original words.
    //
    // Stored separately from mined patterns because they serve a different
    // purpose: a mined "hook" pattern is a phrase to reuse, a hook REFERENCE is
    // a whole opening to analyse and deliberately not reuse. Tagged
    // `hook_reference` so composition can tell them apart.
    const hookPatternIds: number[] = [];
    for (const item of secured) {
      try {
        const opening = extractOpening(item.text);
        if (!opening || opening.split(" ").length < 20) continue;

        const structureLabel = classifyHookStructure(opening);
        const rank = rankedVideos.findIndex((v) => v.videoId === item.videoId);
        const relevance = scoreTopicalRelevance(seedKeyword, item.title);

        // Effectiveness reflects DISCOVERY RANK and TOPICAL RELEVANCE, not the
        // saturated outlierScore/10 mapping used for mined patterns. Measured:
        // 13 of 15 real patterns pinned to the 0.9 ceiling because any score
        // >= 9 clamps, so that mapping carries no signal. Rank-based scoring
        // keeps genuine ordering.
        const rankFactor = rank >= 0 ? Math.max(0.4, 0.85 - rank * 0.05) : 0.5;
        const effectiveness = Math.min(0.9, Math.max(0.3, rankFactor * (0.5 + relevance / 2)));

        const ins = await db.insert(contentPatterns).values({
          sourceVideoId: item.videoId,
          patternType: "hook" as any,
          patternText: opening,
          patternContext: `HOOK REFERENCE · structure=${structureLabel} · video="${item.title.slice(0, 200)}" · relevance=${relevance.toFixed(2)}`,
          effectivenessScore: effectiveness,
          tags: [`research_job_${jobId}`, "hook_reference", `structure_${structureLabel}`],
        });
        const hid = Number((ins as any)[0]?.insertId ?? (ins as any).insertId ?? 0);
        if (hid) hookPatternIds.push(hid);
      } catch (err) {
        console.error(`[DeepResearch] hook reference failed for ${item.videoId}:`, err);
      }
    }

    // ── 5. STRUCTURE SUMMARY (v2.2 Part 3C) ────────────────────────────
    //
    // One aggregate LLM pass over the top 3 transcripts. Best-effort: a failure
    // here must not fail a job that already secured transcripts and patterns.
    let structureSummary: StructureSummary | null = null;
    try {
      const top3 = secured.slice(0, 3);
      if (top3.length > 0) {
        const transcriptBlock = top3
          .map((t, i) => `--- VIDEO ${i + 1}: ${t.title} ---\n${t.text.slice(0, 6000)}`)
          .join("\n\n");
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: STRUCTURE_SUMMARY_PROMPT },
            { role: "user", content: transcriptBlock },
          ],
        });
        const raw = String(resp?.choices?.[0]?.message?.content ?? "").trim();
        // Models often fence JSON; strip the fence before parsing.
        const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        structureSummary = validateStructureSummary(unfenced, top3.map((t) => t.videoId));
        /*
         * DIAGNOSABLE REJECTION. Job #3 completed with structure_summary=no and
         * no explanation anywhere, which made a silently-failing LLM pass
         * indistinguishable from one that was never attempted. Log the raw head
         * on rejection so the next failure is inspectable instead of invisible.
         */
        if (!structureSummary) {
          console.error(
            `[DeepResearch] structure summary REJECTED by validation. ` +
            `raw length=${raw.length}, head=${JSON.stringify(unfenced.slice(0, 400))}`
          );
        } else {
          console.log("[DeepResearch] structure summary accepted");
        }
      } else {
        console.log("[DeepResearch] structure summary skipped: no transcripts secured");
      }
    } catch (err) {
      console.error("[DeepResearch] structure summary threw:", err);
    }

    const notes = [
      `discovery=${discoverySource}`,
      `seed="${seedKeyword}"`,
      `outliers=${outlierVideos.length}`,
      `transcripts=${secured.length}`,
      `patterns=${patternIds.length}`,
      `hook_refs=${hookPatternIds.length}`,
      `on_topic=${onTopic.length}/${outlierVideos.length}`,
      structureSummary ? "structure_summary=yes" : "structure_summary=no",
      quotaBlocked ? "quota_blocked=true" : null,
    ].filter(Boolean).join("; ");

    await setStatus("complete", {
      outlierVideos,
      transcriptVideoIds,
      patternIds: [...patternIds, ...hookPatternIds],
      // longtextJson() types this column correctly now, so no `as any` is needed.
      structureSummary,
      transcriptsFetched,
      transcriptsCached,
      transcriptsFailed,
      quotaBlocked,
      notes,
      errorMessage: null,
    });

    return {
      jobId,
      status: "complete" as const,
      outlierCount: outlierVideos.length,
      hookPatternIds,
      offTopicDropped,
      discoverySource,
      structureSummarySaved: structureSummary !== null,
      transcriptsFetched,
      transcriptsCached,
      transcriptsFailed,
      quotaBlocked,
      patternCount: patternIds.length,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DeepResearch] Job failed:", msg);
    await setStatus("failed", { errorMessage: msg.slice(0, 512) });
    // Return rather than throw: generate()'s fail-open path needs a value.
    return {
      jobId,
      status: "failed" as const,
      outlierCount: 0,
      transcriptsFetched: 0,
      transcriptsCached: 0,
      transcriptsFailed: 0,
      quotaBlocked: false,
      patternCount: 0,
      error: msg.slice(0, 512),
    };
  }
}

export const scriptFactoryRouter = router({

  // ─── Generate a new script ────────────────────────────────────────────────
  generate: protectedProcedure
    .input(z.object({
      topic: z.string().min(10).max(1000),
      format: z.enum(SCRIPT_FORMATS),
      patternTypes: z.array(z.string()).default([
        "hook", "pain_point", "proof_element", "cta", "transformation_arc",
      ]),
      minPatternEffectiveness: z.number().min(0).max(1).default(0.5),
      topPatternsPerType: z.number().min(1).max(5).default(3),
      useCorpusSearch: z.boolean().default(true),

      // ── Phase 2 additions ───────────────────────────────────────────────
      /** Target persona; replaces the generic audience line and drives the CTA. */
      personaId: z.number().int().positive().optional(),
      /** Operator-selected analog entries used as the explicit Northstar. */
      analogDataEntryIds: z.array(z.number().int().positive()).max(5).optional(),
      /** Only meaningful for long-form video. */
      targetLengthMinutes: z.union([z.literal(10), z.literal(15), z.literal(20)]).optional(),
      /** The `suggested_ideas` row this script came from, if any. */
      sourceIdeaId: z.number().int().positive().optional(),

      // ── Phase 3 additions ───────────────────────────────────────────────
      /** Use the most recent complete research job for this topic. */
      useDeepResearch: z.boolean().default(false),
      /** Use one specific research job. */
      researchJobId: z.number().int().positive().optional(),

      // ── Part 3C — RESEARCH-FIRST ────────────────────────────────────────
      /**
       * Opt OUT of automatic research, rather than opting in.
       *
       * v2.2 inverts the v2.1 default. Previously `useDeepResearch` defaulted to
       * false, so the ordinary path produced ungrounded scripts and grounding was
       * something you had to remember to ask for. Now a long-form script runs
       * research unless this is explicitly set, which is what "research-first"
       * has to mean to be true.
       *
       * Kept as a separate flag from `useDeepResearch` so existing callers that
       * pass `useDeepResearch: true` keep working unchanged.
       */
      skipResearch: z.boolean().default(false),
      /**
       * The keyword to research, when it differs from the topic. Idea cards
       * already carry one; passing it through means auto-research reuses by the
       * same key the research pipeline stores, rather than by prose topic text
       * that never matches twice.
       */
      seedKeyword: z.string().trim().max(255).optional(),

      // ── Part 3A ─────────────────────────────────────────────────────────
      /**
       * How stories may be handled. `brief` emits a delimited slot for the
       * operator's real case; `composite` allows a labelled de-identified
       * narrative; `none` omits stories and moves the budget to teaching.
       * Defaults to `brief`: the safe mode must be the one you get by default.
       */
      storyMode: z.enum(STORY_MODES).default("brief"),
      /**
       * Part 3B — the operator's own close, in their words. When present this
       * REPLACES offer binding entirely rather than sitting alongside it.
       */
      ctaOverride: z.string().trim().min(3).max(500).optional(),
      /**
       * Part 3B multi-tier — which tier of a laddered offer this script closes
       * on, by exact `offerName`. Omitted with several tiers available means
       * "not chosen yet": generation proceeds UNBOUND and returns the choices,
       * rather than picking a price point on the operator's behalf.
       */
      offerTier: z.string().trim().min(1).max(200).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Target length only applies to long-form video; silently ignored elsewhere
      // so the client never has to special-case clearing it.
      const targetLengthMinutes = input.format === "youtube_script"
        ? input.targetLengthMinutes
        : undefined;

      // 1. Pull top patterns per type
      const allPatterns: typeof contentPatterns.$inferSelect[] = [];
      const usedPatternIds: number[] = [];

      for (const type of input.patternTypes) {
        const rows = await db
          .select()
          .from(contentPatterns)
          .where(
            and(
              eq(contentPatterns.patternType, type as any),
              sql`effectiveness_score >= ${input.minPatternEffectiveness}`
            )
          )
          .orderBy(desc(contentPatterns.effectivenessScore))
          .limit(input.topPatternsPerType);
        allPatterns.push(...rows);
        usedPatternIds.push(...rows.map((r) => r.id));
      }

      // 1b. Explicit Northstar — operator-selected analog entries (Phase 2.3.1).
      // When present these REPLACE the keyword-matched analog lookup entirely:
      // a deliberate choice must not be diluted by fuzzy retrieval.
      const northStarIds = input.analogDataEntryIds ?? [];
      // Part 3B — resolved below from the selected North Star entries.
      let boundOffer: OfferProfile | null = null;
      let boundOfferEntryId: number | null = null;
      let offerBindReason: string | null = null;
      let unresolvedOfferTiers: { offerName: string; pricePoint: string | null }[] = [];
      let explicitNorthStar: { title: string | null; content: string; type: string | null }[] = [];
      if (northStarIds.length > 0) {
        const rows = await db
          .select({
            id: analogDataEntries.id,
            title: analogDataEntries.title,
            content: analogDataEntries.content,
            type: analogDataEntries.type,
            offerProfile: analogDataEntries.offerProfile,
          })
          .from(analogDataEntries)
          .where(inArray(analogDataEntries.id, northStarIds));
        // Preserve the operator's ordering — the first pick is the primary model.
        explicitNorthStar = northStarIds
          .map((id) => rows.find((r) => r.id === id))
          .filter((r): r is typeof rows[number] => Boolean(r))
          .map((r) => ({ title: r.title, content: r.content, type: r.type }));
        /**
         * Part 3B — bind the CTA to the FIRST selected entry that has a validated
         * offer. First-pick-wins mirrors the existing rule that the
         * operator's first selection is the primary model; binding to several
         * offers at once would produce a script selling two things.
         *
         * An entry with no offer, or one that fails validation, simply
         * does not bind. Generation proceeds unbound rather than guessing.
         *
         * MULTI-TIER: a page that ladders several purchasable tiers does NOT
         * auto-bind. Silently choosing a tier would make the script sell a price
         * point the operator never picked, so an unchosen ladder generates
         * unbound and reports the available tiers back to the caller.
         */
        for (const id of northStarIds) {
          const row = rows.find((r) => r.id === id);
          if (!row) continue;
          const ladder = parseStoredOfferLadder(row.offerProfile);
          if (ladder.tiers.length === 0) continue;
          const picked = selectOfferTier(ladder, input.offerTier);
          if (picked.profile) {
            boundOffer = picked.profile;
            boundOfferEntryId = id;
            offerBindReason = picked.reason;
            break;
          }
          // Tiers exist but none resolved: surface them so the UI can ask.
          offerBindReason = picked.reason;
          unresolvedOfferTiers = ladder.tiers.map((t) => ({
            offerName: t.offerName,
            pricePoint: t.pricePoint,
          }));
          boundOfferEntryId = id;
          break;
        }
      }

      // 2. Corpus retrieval. Vector search is primary (Phase 2.3.2); the keyword
      //    LIKE query remains as the documented fallback when embeddings are
      //    unavailable (no API key, network failure, or no embedded rows).
      let corpusExcerpts: { title: string | null; content: string; sourceType: string; id: number }[] = [];
      const usedCorpusIds: number[] = [];
      let retrievalMethod: "vector" | "keyword" | "none" = "none";

      if (input.useCorpusSearch) {
        // With an explicit Northstar we only need supporting transcripts; without
        // one we still need analog entries to anchor the script.
        const wantAnalog = explicitNorthStar.length === 0;

        try {
          const hits = await searchCorpusEntries(db, {
            query: input.topic,
            topK: 8,
            sourceType: "all",
          });
          retrievalMethod = hits.method;

          const analogHits = wantAnalog
            ? hits.results.filter((h) => h.sourceType === "analog_data").slice(0, 3)
            : [];
          const transcriptHits = hits.results
            .filter((h) => h.sourceType !== "analog_data")
            .slice(0, Math.max(0, 5 - analogHits.length));

          corpusExcerpts = [...analogHits, ...transcriptHits].map((h) => ({
            id: h.id,
            title: h.title,
            content: h.content,
            sourceType: h.sourceType,
          }));
          usedCorpusIds.push(...corpusExcerpts.map((r) => r.id));
        } catch {
          // Retrieval is best-effort: a corpus outage must not block generation.
          retrievalMethod = "none";
        }

        // Last-resort fallback, unchanged from v1 behavior.
        if (corpusExcerpts.length === 0 && wantAnalog) {
          const analogFallback = await db
            .select({ id: corpusEntries.id, title: corpusEntries.title, content: corpusEntries.content, sourceType: corpusEntries.sourceType })
            .from(corpusEntries)
            .where(and(eq(corpusEntries.inCorpus, 1), eq(corpusEntries.sourceType, "analog_data")))
            .orderBy(desc(corpusEntries.createdAt))
            .limit(3);
          corpusExcerpts = analogFallback;
          usedCorpusIds.push(...analogFallback.map((r) => r.id));
        }
      }

      // 2b. Persona context (Phase 2.3.3).
      let personaContext: PersonaContext | null = null;
      if (input.personaId) {
        const personaRows = await db
          .select()
          .from(personas)
          .where(eq(personas.id, input.personaId))
          .limit(1);
        if (personaRows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Persona ${input.personaId} not found` });
        }
        const persona = personaRows[0];
        // The avatar helper matches on NAME against a separate table and returns
        // "" when it finds nothing, so this is always safe.
        let avatarBlock = "";
        try {
          avatarBlock = await getAvatarContextBlockForPersona(input.topic, persona.name);
        } catch {
          avatarBlock = "";
        }
        personaContext = buildPersonaBlock(persona, avatarBlock);
      }

      // 3. Deep research context (Phase 3.5). Resolved before generation so the
      //    competitive block can be injected into the same prompt.
      //
      // v2.2 Part 3C — RESEARCH-FIRST GENERATION.
      //
      // A long-form script now RUNS research when none exists, instead of
      // silently generating ungrounded because nobody ticked a box. Three
      // behaviours matter here and each is deliberate:
      //
      //   REUSE — a complete job for the same seed within the reuse window is
      //   reused at zero cost. Without this, every generation on a topic would
      //   spend fresh vidIQ credits and Supadata units on research that already
      //   exists, which would make research-first prohibitively expensive.
      //
      //   FAIL-OPEN — research failure must never fail generation. vidIQ can be
       //  down, out of credits, or return nothing for an obscure seed; in every
      //   such case the operator still gets their script, just ungrounded and
      //   labelled as such. A hard failure here would make v2.2 strictly worse
      //   than v2.1 for the user.
      //
      //   HONEST REPORTING — `researchAttempted` / `researchReused` /
      //   `researchFailureReason` are returned so the UI can state what actually
      //   happened rather than implying grounding that is not there.
      const RESEARCH_REUSE_DAYS = 14;
      const wantsAutoResearch =
        !input.skipResearch &&
        !input.researchJobId &&
        !input.useDeepResearch &&
        input.format === "youtube_script";

      let autoResearchJobId: number | undefined;
      let researchAttempted = false;
      let researchReused = false;
      let researchFailureReason: string | null = null;

      if (wantsAutoResearch) {
        researchAttempted = true;
        const seed = (input.seedKeyword ?? input.topic).slice(0, 255);
        try {
          // Reuse first: cheapest possible outcome.
          const cutoff = new Date(Date.now() - RESEARCH_REUSE_DAYS * 86400_000);
          const existing = await db
            .select({ id: researchJobs.id, createdAt: researchJobs.createdAt })
            .from(researchJobs)
            .where(and(
              eq(researchJobs.seedKeyword, seed),
              eq(researchJobs.status, "complete"),
              gte(researchJobs.createdAt, cutoff),
            ))
            .orderBy(desc(researchJobs.createdAt))
            .limit(1);

          if (existing[0]) {
            autoResearchJobId = existing[0].id;
            researchReused = true;
            console.log(`[ScriptFactory] reusing research job #${autoResearchJobId} for seed "${seed}"`);
          } else {
            const rr = await executeDeepResearch(db, {
              topic: input.topic,
              seedKeyword: seed,
              maxTranscripts: 3,
            });
            if (rr.status === "complete") {
              autoResearchJobId = rr.jobId;
            } else {
              researchFailureReason = rr.error ?? "Research produced no usable grounding";
            }
          }
        } catch (err) {
          // FAIL-OPEN. Recorded, reported, and then generation continues.
          researchFailureReason = err instanceof Error ? err.message.slice(0, 300) : "Research failed";
          console.error("[ScriptFactory] auto-research failed (continuing ungrounded):", err);
        }
      }

      const research = await resolveResearchContext(db, {
        useDeepResearch: input.useDeepResearch || Boolean(autoResearchJobId),
        researchJobId: input.researchJobId ?? autoResearchJobId,
        topic: input.topic,
      });

      /*
       * FINDING #10 DISCLOSURE. If resolution threw, the job may be `complete`
       * with real transcripts on disk yet none of it reached the prompt. Report
       * that explicitly rather than letting it look like a clean ungrounded run.
       */
      if (research.resolutionError && !researchFailureReason) {
        researchFailureReason = `Research completed but its grounding could not be loaded: ${research.resolutionError.slice(0, 240)}`;
      }

      // Patterns mined from the research job join the pool for this script.
      let researchPatterns: typeof contentPatterns.$inferSelect[] = [];
      if (hasItems<number>(research.patternIds)) {
        researchPatterns = await db
          .select()
          .from(contentPatterns)
          .where(inArray(contentPatterns.id, research.patternIds));
        for (const p of researchPatterns) {
          if (!usedPatternIds.includes(p.id)) usedPatternIds.push(p.id);
        }
      }
      const promptPatterns = [...allPatterns, ...researchPatterns];

      // 3b. Legacy Supadata path. Retired whenever a research job supplies
      //     competitive context (Phase 3.3) — the job's ledgered, cached
      //     transcripts supersede the un-ledgered 800-char excerpts.
      const externalTranscripts = research.jobId
        ? []
        : await fetchRelevantTranscripts(input.topic, 3);

      // 3c. Build grounded context + system prompt
      const groundedContext = buildGroundedContext(
        promptPatterns,
        corpusExcerpts,
        externalTranscripts,
        explicitNorthStar,
        research.context
      );
      const lengthInstruction = buildLengthInstruction(targetLengthMinutes);
      const systemPrompt = buildSystemPrompt(input.format, groundedContext, {
        persona: personaContext,
        lengthInstruction,
        storyMode: input.storyMode,
        offerProfile: boundOffer,
        ctaOverride: input.ctaOverride ?? null,
        // v2.2 Part 3C — structural grounding. Empty strings when no research
        // exists, so an ungrounded run gets no misleading scaffolding.
        hookBlock: research.hookBlock,
        structureBlock: research.structureBlock,
      });

      // 4. Generate script via LLM
      const budget = targetLengthMinutes ? wordBudget(targetLengthMinutes) : null;
      const lengthAsk = budget
        ? `\n\nThis must be a ${targetLengthMinutes}-minute script: approximately ${budget.target} spoken words. Write the FULL script.`
        : "";

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write a ${FORMAT_DESCRIPTIONS[input.format]} about the following topic:\n\n${input.topic}\n\nRemember to tag verified elements with [VERIFIED] inline.${lengthAsk}`,
          },
        ],
      });

      let scriptBody = String(response?.choices?.[0]?.message?.content ?? "");
      if (!scriptBody || scriptBody.length < 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty script" });
      }

      // 4b. Length enforcement (Phase 2.3.4). Models routinely under-deliver on
      //     long asks, so if we land below 80% of target we run exactly ONE
      //     continuation pass that expands the thinnest sections in place.
      let continuationPassUsed = false;
      if (budget) {
        // Part 3A: story slots are credited at ~200 words each and their
        // instructional text is excluded. Without this, a COMPLIANT script that
        // emitted two slots would read ~400 words short, trip this gate, and the
        // continuation prompt below would explicitly ask the model to "deepen
        // the thinnest [STORY] sections" — i.e. length enforcement would demand
        // the very fabricated story the integrity rules forbid.
        const counted = countWordsWithStorySlots(scriptBody);
        const firstPassWords = counted.words;
        if (firstPassWords < budget.target * 0.8) {
          try {
            const continuation = await invokeLLM({
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `Write a ${FORMAT_DESCRIPTIONS[input.format]} about: ${input.topic}`,
                },
                { role: "assistant", content: scriptBody },
                {
                  role: "user",
                  content:
                    `This draft is ${firstPassWords} words but the target is ${budget.target} ` +
                    `(minimum ${budget.min}). Expand it to full length.\n\n` +
                    "RULES:\n" +
                    "- Return the COMPLETE expanded script, not just the new parts.\n" +
                    "- Keep every existing [VERIFIED] tag exactly where it is.\n" +
                    "- Deepen the thinnest [TEACH], [STORY], and [PROOF] sections with concrete\n" +
                    "  examples, specific mechanisms, and immediately actionable steps.\n" +
                    "- Do NOT pad with filler, repetition, or restatement.\n" +
                    "- Preserve the same structure tags and section order.",
                },
              ],
            });
            const expanded = String(continuation?.choices?.[0]?.message?.content ?? "");
            // Only accept the retry if it actually improved length.
            if (expanded.length > 50 && countWords(expanded) > firstPassWords) {
              scriptBody = expanded;
              continuationPassUsed = true;
            }
          } catch {
            // A failed expansion leaves the (short but valid) first pass intact.
          }
        }
      }

      // 4c. STORY INTEGRITY ENFORCEMENT (Part 3A).
      //
      // Runs AFTER the continuation pass, because that pass rewrites the whole
      // script and could reintroduce a fabricated patient that an earlier check
      // had cleared. One automatic correction attempt; if it still violates we
      // throw, and because nothing has been inserted yet, nothing is saved.
      // A violating script must never reach the library.
      let storyLint = lintStoryIntegrity(scriptBody, input.storyMode);
      let storyCorrectionPassUsed = false;
      if (storyLint.violations.length > 0 || storyLint.missingCompositeLabel) {
        const digest = formatViolations(storyLint.violations, storyLint.missingCompositeLabel);
        console.warn(`[ScriptFactory] story integrity violations (mode=${input.storyMode}):\n${digest}`);
        try {
          const corrected = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Write a ${FORMAT_DESCRIPTIONS[input.format]} about: ${input.topic}`,
              },
              { role: "assistant", content: scriptBody },
              {
                role: "user",
                content:
                  "STOP. This draft violates the STORY INTEGRITY rules. These are " +
                  "non-negotiable: the script is for a licensed practitioner with real " +
                  "patients, and an invented patient is indistinguishable from a real " +
                  "one to a listener.\n\nVIOLATIONS FOUND:\n" + digest +
                  "\n\nRewrite the COMPLETE script, fixing every violation:\n" +
                  "- Remove every invented named individual and every quoted patient line.\n" +
                  "- Remove every individual-attributed lab value, diagnosis and recovery timeline.\n" +
                  (input.storyMode === "brief"
                    ? "- Replace any narrative with the delimited STORY SLOT block exactly as specified.\n"
                    : input.storyMode === "composite"
                      ? "- Keep the narrative but open it with the audible composite label and remove all proper names.\n"
                      : "- Remove story sections entirely and expand the teaching sections instead.\n") +
                  "- Population-level evidence stays; individual fabrication goes.\n" +
                  "- Preserve every [VERIFIED] tag and the existing structure and length.",
              },
            ],
          });
          const fixed = String(corrected?.choices?.[0]?.message?.content ?? "");
          if (fixed.length > 50) {
            const recheck = lintStoryIntegrity(fixed, input.storyMode);
            // Accept only a genuine improvement; a rewrite that trades one
            // violation for another is not progress.
            if (recheck.violations.length === 0 && !recheck.missingCompositeLabel) {
              scriptBody = fixed;
              storyLint = recheck;
              storyCorrectionPassUsed = true;
            } else if (recheck.violations.length < storyLint.violations.length) {
              scriptBody = fixed;
              storyLint = recheck;
              storyCorrectionPassUsed = true;
            }
          }
        } catch (err) {
          // A failed correction call must not mask the violation below.
          console.error("[ScriptFactory] story correction pass failed:", err);
        }

        if (storyLint.violations.length > 0 || storyLint.missingCompositeLabel) {
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message:
              "Generation refused: the model fabricated patient material and did not " +
              "correct it. Nothing was saved.\n\n" +
              formatViolations(storyLint.violations, storyLint.missingCompositeLabel),
          });
        }
      }

      // 5. Count [VERIFIED] tags (before stripping — so percentage is accurate)
      const { verified, total, pct } = countVerifiedTags(scriptBody);

      // Strip internal markup tags from the clean copy:
      // - [VERIFIED] tags are internal grounding markers — never shown to end users
      // - Structure tags [HOOK], [PAIN], [PROOF], etc. are kept as readable section labels
      //   but [VERIFIED] must be removed so copy-paste output is clean
      const cleanScriptBody = scriptBody
        .replace(/\[VERIFIED\]/g, "")
        .replace(/ {2,}/g, " ")
        .trim();

      // 6. Generate title
      const titleResponse = await invokeLLM({
        messages: [
          { role: "system", content: "Generate a concise, compelling title for this script. Return only the title, nothing else. Max 80 characters." },
          { role: "user", content: `Topic: ${input.topic}\nFormat: ${input.format}\n\nFirst 200 chars of script:\n${cleanScriptBody.slice(0, 200)}` },
        ],
      });
      const title = String(titleResponse?.choices?.[0]?.message?.content ?? input.topic).slice(0, 500).trim();

      const finalWordCount = countWords(cleanScriptBody);

      // 7. Save to DB (store clean version without [VERIFIED] tags)
      const insertResult = await db.insert(scriptFactoryOutputs).values({
        title,
        topic: input.topic,
        format: input.format,
        scriptBody: cleanScriptBody,
        verifiedPatternIds: usedPatternIds,
        corpusEntryIds: usedCorpusIds,
        verifiedCount: verified,
        totalElements: total,
        verificationPct: pct,
        status: "draft",
        // ── Phase 2/3 provenance ──────────────────────────────────────────
        personaId: input.personaId ?? null,
        analogDataEntryIds: northStarIds.length > 0 ? northStarIds : null,
        targetLengthMinutes: targetLengthMinutes ?? null,
        sourceIdeaId: input.sourceIdeaId ?? null,
        researchJobId: research.jobId ?? null,
        wordCount: finalWordCount,
      });

      const insertId = Number(
        (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId ?? 0
      );

      // v2.1 Bug A item 1 — ordering hardening.
      //
      // The insert above already runs BEFORE the idea is stamped, so a failed
      // insert can never produce a `generated` idea (the throw exits here). The
      // one remaining hole was a *silent* one: if the driver returned no usable
      // insertId we used to fall through with `insertId = 0`, handing the client
      // an unopenable id 0 and leaving the script unreachable. Failing loudly is
      // correct — the row exists, but we cannot address it, and the operator
      // needs to know that rather than discover it later in the Library.
      if (!Number.isFinite(insertId) || insertId <= 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Script was saved but the database did not return its id, so it cannot be opened. " +
            "Check the Library for the newest draft before regenerating.",
        });
      }

      // 7b. Close the loop on the originating idea (Phase 2.3.5).
      //     Reached only once the script row is committed AND addressable, so
      //     the idea can never be stamped `generated` without a real script.
      //     Still best-effort: bookkeeping must not fail a successful generation.
      if (input.sourceIdeaId) {
        try {
          await db
            .update(suggestedIdeas)
            .set({
              status: "generated",
              generatedScriptId: insertId,
              updatedAt: sql`NOW()`,
            })
            .where(eq(suggestedIdeas.id, input.sourceIdeaId));
        } catch (err) {
          console.error("[ScriptFactory] Failed to link source idea:", err);
        }
      }

      // 8. Increment usage on patterns used
      if (usedPatternIds.length > 0) {
        await db
          .update(contentPatterns)
          .set({
            usageCount: sql`usage_count + 1`,
            lastUsedAt: sql`NOW()`,
          })
          .where(inArray(contentPatterns.id, usedPatternIds));
      }

      return {
        id: insertId,
        title,
        scriptBody: cleanScriptBody,
        verifiedCount: verified,
        totalElements: total,
        verificationPct: pct,
        patternsUsed: promptPatterns.length,
        corpusEntriesUsed: corpusExcerpts.length,
        externalTranscriptsUsed: externalTranscripts.length,
        // ── Phase 2/3 transparency: let the UI show HOW this was built ─────
        wordCount: finalWordCount,
        targetWordCount: budget?.target ?? null,
        targetLengthMinutes: targetLengthMinutes ?? null,
        continuationPassUsed,
        // Part 3A: surfaced so the operator can see when the model had to be
        // corrected, rather than the correction happening silently.
        storyMode: input.storyMode,
        storyCorrectionPassUsed,
        storySlotCount: countWordsWithStorySlots(scriptBody).slotCount,
        // Part 3B — the operator must be able to see WHY a CTA closed the way it
        // did: bound to an offer, overridden, or unbound.
        offerBinding: input.ctaOverride
          ? { mode: "override" as const, offerName: null, entryId: null }
          : boundOffer
            ? { mode: "offer" as const, offerName: boundOffer.offerName, entryId: boundOfferEntryId }
            : { mode: "unbound" as const, offerName: null, entryId: null },
        // Multi-tier: when a ladder was found but no tier chosen, the caller gets
        // the reason and the options so the UI can ask instead of guessing.
        offerBindReason,
        unresolvedOfferTiers,
        retrievalMethod,
        personaName: personaContext?.name ?? null,
        northStarCount: explicitNorthStar.length,
        northStarTitles: explicitNorthStar.map((e) => e.title ?? "Untitled"),
        researchJobId: research.jobId ?? null,
        researchOutliersUsed: research.outlierCount,
        researchTranscriptsUsed: research.transcriptCount,
        researchPatternsUsed: researchPatterns.length,
        // ── Part 3C: honest grounding disclosure ───────────────────────────
        // Each of these answers a distinct question, because one boolean cannot.
        // "Was research attempted" is not "did it succeed", and "did it succeed"
        // is not "was it fresh". A UI that shows a single "researched" badge
        // would imply grounding on a run that failed open and produced none.
        researchAttempted,
        researchReused,
        researchFailureReason,
        /*
         * HONEST METRIC: grounded means grounding text actually reached the
         * prompt. `jobId !== null` was the old test and it reported TRUE for the
         * finding #10 runs where resolution threw and context was empty.
         */
        researchGrounded:
          research.jobId !== null && (research.context.length > 0 || research.hookBlock.length > 0),
        /*
         * WHAT it was grounded in. A nonsense-seeded run once reported
         * researchGrounded=true while grounded in a Hindi/Urdu TV drama
         * transcript; the boolean was accurate and the script was worthless.
         * These two fields make the badge auditable at a glance.
         */
        researchGroundingSources: research.groundingSources,
        researchOnTopicRatio: research.onTopicRatio,
        hookReferencesUsed: research.hookReferenceCount,
        structureSummaryUsed: research.hasStructureSummary,
        sourceIdeaId: input.sourceIdeaId ?? null,
      };
    }),

  // ─── List saved scripts ───────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      format: z.enum([...SCRIPT_FORMATS, "all"] as [string, ...string[]]).default("all"),
      status: z.enum(["draft", "approved", "archived", "all"]).default("all"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.format !== "all") conditions.push(eq(scriptFactoryOutputs.format, input.format as ScriptFormat));
      if (input.status !== "all") conditions.push(eq(scriptFactoryOutputs.status, input.status as any));

      return db
        .select({
          id: scriptFactoryOutputs.id,
          title: scriptFactoryOutputs.title,
          topic: scriptFactoryOutputs.topic,
          format: scriptFactoryOutputs.format,
          verifiedCount: scriptFactoryOutputs.verifiedCount,
          totalElements: scriptFactoryOutputs.totalElements,
          verificationPct: scriptFactoryOutputs.verificationPct,
          status: scriptFactoryOutputs.status,
          createdAt: scriptFactoryOutputs.createdAt,
          // v2 provenance — lets the Library badge production state and depth
          // without a second round trip per row.
          productionScriptId: scriptFactoryOutputs.productionScriptId,
          wordCount: scriptFactoryOutputs.wordCount,
          targetLengthMinutes: scriptFactoryOutputs.targetLengthMinutes,
          personaId: scriptFactoryOutputs.personaId,
          researchJobId: scriptFactoryOutputs.researchJobId,
        })
        .from(scriptFactoryOutputs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(scriptFactoryOutputs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get a single script ──────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(scriptFactoryOutputs)
        .where(eq(scriptFactoryOutputs.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  // ─── Update script status or notes ───────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "approved", "archived"]).optional(),
      notes: z.string().max(2000).optional(),
      scriptBody: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const updates: Record<string, unknown> = {};
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.scriptBody) {
        updates.scriptBody = input.scriptBody;
        const { verified, total, pct } = countVerifiedTags(input.scriptBody);
        updates.verifiedCount = verified;
        updates.totalElements = total;
        updates.verificationPct = pct;
      }
      if (input.status) {
        updates.status = input.status;
        // Only update updatedAt on status changes — NOT on notes/body edits.
        updates.updatedAt = sql`NOW()`;
        // Set approvedAt once when first approved — this is the stable 90-day clock.
        // Re-approving an archived script does NOT reset approvedAt so the original
        // approval date is preserved for the Performance Loop eligibility window.
        if (input.status === "approved") {
          updates.approvedAt = sql`COALESCE(approved_at, NOW())`;
        }
      }

      await db.update(scriptFactoryOutputs).set(updates as any).where(eq(scriptFactoryOutputs.id, input.id));
      return { ok: true };
    }),

  // ─── Delete a script ──────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Delete associated feedback rows first — no FK cascade exists on script_performance_feedback.script_id.
      // Orphaned rows inflate the Performance Loop history count and cause the EMA-reversal
      // path in deleteFeedback to silently fail when it tries to look up the deleted script.
      await db.delete(scriptPerformanceFeedback).where(eq(scriptPerformanceFeedback.scriptId, input.id));
      await db.delete(scriptFactoryOutputs).where(eq(scriptFactoryOutputs.id, input.id));
      return { ok: true };
    }),

  // ─── Production bridge: hand an approved script to the Kanban ─────────────
  /**
   * Promote an approved Script Factory output into the Script Library (Phase 4).
   *
   * This is the seam between generation and production. It creates exactly one
   * `scripts` row and records its id back on the output, which makes the call
   * idempotent: pressing the button twice returns the existing production
   * script instead of creating a duplicate card on the board.
   *
   * It deliberately writes ONLY the `scripts` row. The existing
   * `scripts.updateStatus` flow owns content-item creation when a script later
   * reaches `ready_to_post`, and that behavior is left completely untouched.
   */
  sendToProduction: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      /** Optional override; defaults to the persona chosen at generation time. */
      personaId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(scriptFactoryOutputs)
        .where(eq(scriptFactoryOutputs.id, input.id))
        .limit(1);
      const output = rows[0];
      if (!output) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Script ${input.id} not found` });
      }

      // Only approved work reaches the production board. Draft scripts are still
      // being iterated on, and archived ones were explicitly set aside.
      if (output.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approve this script before sending it to production.",
        });
      }

      // Idempotency guard — verify the linked row still exists, so a manually
      // deleted production card can be legitimately re-created.
      if (output.productionScriptId) {
        const existing = await db
          .select({ id: scripts.id })
          .from(scripts)
          .where(eq(scripts.id, output.productionScriptId))
          .limit(1);
        if (existing.length > 0) {
          return {
            productionScriptId: output.productionScriptId,
            alreadyInProduction: true,
            title: output.title,
          };
        }
      }

      // Provenance the production board can act on: where this came from and how
      // well grounded it was.
      const noteLines = [
        `Generated by Script Factory (output #${output.id}).`,
        `Topic: ${output.topic}`,
        `Format: ${output.format}`,
        output.verificationPct != null
          ? `Grounding: ${output.verificationPct.toFixed(0)}% verified (${output.verifiedCount}/${output.totalElements} elements)`
          : null,
        output.wordCount ? `Word count: ${output.wordCount}` : null,
        output.researchJobId ? `Competitive research job: #${output.researchJobId}` : null,
        output.sourceIdeaId ? `Source idea: #${output.sourceIdeaId}` : null,
      ].filter(Boolean);

      const insertResult = await db.insert(scripts).values({
        title: output.title.slice(0, 255),
        scriptType: "video",
        platform: "youtube",
        personaId: input.personaId ?? output.personaId ?? undefined,
        contentGoal: "audience_growth",
        // Enters the board as fully scripted work, not a raw idea.
        productionStatus: "scripted",
        scriptBody: output.scriptBody,
        notes: noteLines.join("\n"),
        estimatedDurationMin: output.targetLengthMinutes ?? undefined,
      });

      const productionScriptId = Number(
        (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId ?? 0
      );
      if (!productionScriptId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Production script could not be created",
        });
      }

      // Back-link so the next call short-circuits.
      await db
        .update(scriptFactoryOutputs)
        .set({ productionScriptId, updatedAt: sql`NOW()` })
        .where(eq(scriptFactoryOutputs.id, input.id));

      return {
        productionScriptId,
        alreadyInProduction: false,
        title: output.title,
      };
    }),

  // ─── Deep Research: find and mine the winning videos on a topic ───────────
  /**
   * Run a deep research job for a topic (Phase 3).
   *
   * Pipeline, with the job row updated at each stage so the UI can poll it:
   *   1. Discover overperforming videos via VidIQ outliers (with a trending
   *      fallback if the outlier tool returns nothing).
   *   2. Secure transcripts for the top-ranked videos through the SHARED
   *      Supadata quota ledger — cache hits cost nothing, and the daily cap
   *      stops the loop rather than being bypassed.
   *   3. Mine reusable patterns from those transcripts into `content_patterns`,
   *      tagged `research_job_<id>` so they are traceable and removable.
   *
   * Partial success is a first-class outcome: a job that found outliers but hit
   * the transcript cap still completes and is still useful to `generate`.
   */
  runDeepResearch: protectedProcedure
    .input(z.object({
      topic: z.string().min(3).max(500),
      seedKeyword: z.string().max(255).optional(),
      /** How many outlier videos to try to secure transcripts for. */
      maxTranscripts: z.number().int().min(1).max(5).default(3),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // v2.2 Part 3C: delegates to the shared pipeline. The procedure keeps its
      // throw-on-failure contract (the UI surfaces the error), while generate()
      // reads the returned result and proceeds unbound.
      const result = await executeDeepResearch(db, input);
      if (result.status === "failed" && result.outlierCount === 0 && result.error) {
        // A clean explained failure is still returned, not thrown, when it is
        // the "nothing to research" case the UI renders as a reason.
        return result;
      }
      return result;
    }),

  // ─── Poll a research job ──────────────────────────────────────────────────
  /**
   * Read one research job, or the latest job for a topic.
   *
   * The UI polls this while a job runs, so it returns the stage, the counters,
   * and the ranked outliers as soon as they exist — not only at completion.
   */
  getResearchJob: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      topic: z.string().max(500).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      let rows: typeof researchJobs.$inferSelect[] = [];
      if (input.id) {
        rows = await db.select().from(researchJobs).where(eq(researchJobs.id, input.id)).limit(1);
      } else if (input.topic) {
        rows = await db
          .select()
          .from(researchJobs)
          .where(eq(researchJobs.topic, input.topic.slice(0, 500)))
          .orderBy(desc(researchJobs.createdAt))
          .limit(1);
      }

      const job = rows[0];
      if (!job) return null;

      const outliers = asArray<StoredOutlier>(job.outlierVideos);
      return {
        id: job.id,
        topic: job.topic,
        seedKeyword: job.seedKeyword,
        status: job.status,
        outlierVideos: outliers,
        outlierCount: outliers.length,
        transcriptVideoIds: asArray<string>(job.transcriptVideoIds),
        patternIds: asArray<number>(job.patternIds),
        patternCount: (asArray<number>(job.patternIds)).length,
        transcriptsFetched: job.transcriptsFetched,
        transcriptsCached: job.transcriptsCached,
        transcriptsFailed: job.transcriptsFailed,
        quotaBlocked: job.quotaBlocked,
        notes: job.notes,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    }),

  // ─── Suggest video ideas — analog data BLENDED with live research ─────────
  /**
   * Script Factory v2 idea engine.
   *
   * Blends two grounding sources instead of one:
   *   A. ANALOG DATA — the operator's own proven-converting assets (what this
   *      audience already pays for).
   *   B. LIVE RESEARCH — VidIQ keyword research seeded from that same analog
   *      data (what this audience is searching for right now).
   *
   * Every idea is persisted to `suggested_ideas`, so suggestions survive page
   * reloads and accumulate into a permanent memory used for deduplication.
   *
   * Research is best-effort: if the VidIQ balance is too low or every seed call
   * fails, generation still proceeds on analog data alone and the response
   * reports `researchSkipped` with a reason. Idea generation must never be
   * blocked by a third-party API.
   */
  suggestIdeas: protectedProcedure
    .input(z.object({
      count: z.number().min(3).max(10).default(6),
      /** Set by the weekly cron so auto-generated batches are distinguishable. */
      source: z.enum(["weekly_auto", "manual_generate"]).default("manual_generate"),
      /** Skip the VidIQ leg entirely (useful for fast manual runs / tests). */
      skipResearch: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // 1. Pull analog data entries (proven converting content)
      const analogRows = await db
        .select({
          id: analogDataEntries.id,
          title: analogDataEntries.title,
          type: analogDataEntries.type,
          content: analogDataEntries.content,
          tags: analogDataEntries.tags,
          extractedInsights: analogDataEntries.extractedInsights,
        })
        .from(analogDataEntries)
        .orderBy(desc(analogDataEntries.createdAt))
        .limit(10);

      // 2. Pull published video titles (to identify gaps)
      const publishedVideos = await db
        .select({
          title: videoJobs.youtubeTitle,
        })
        .from(videoJobs)
        .where(eq(videoJobs.status, "published"))
        .orderBy(desc(videoJobs.createdAt))
        .limit(50);

      // 2b. Pull existing script library topics (deduplication — avoid repeating already-generated ideas)
      const existingScripts = await db
        .select({
          topic: scriptFactoryOutputs.topic,
          title: scriptFactoryOutputs.title,
        })
        .from(scriptFactoryOutputs)
        .orderBy(desc(scriptFactoryOutputs.createdAt))
        .limit(100);

      // 3. Build context for LLM
      const analogContext = analogRows.length > 0
        ? analogRows.map((r) => {
            const insights = r.extractedInsights ? (() => {
              try { return JSON.parse(r.extractedInsights!); } catch { return null; }
            })() : null;
            const hooks = insights?.hooks?.slice(0, 2).join(" | ") ?? "";
            const painPoints = insights?.painPoints?.slice(0, 2).join(" | ") ?? "";
            return `[${r.type?.toUpperCase() ?? "CONTENT"}] ${r.title ?? "Untitled"}${hooks ? ` | Hooks: ${hooks}` : ""}${painPoints ? ` | Pain: ${painPoints}` : ""}`;
          }).join("\n")
        : "No analog data yet — generate ideas based on Urban Monk audience persona (health-conscious professionals 35-55).";

      const publishedContext = publishedVideos.length > 0
        ? publishedVideos.map((v) => `- ${v.title}`).join("\n")
        : "No published videos yet.";

      // Build existing scripts context for deduplication
      // Use title as primary (notNull) and topic as secondary to avoid null fallback
      const existingScriptsContext = existingScripts.length > 0
        ? existingScripts.map((s) => `- ${s.title ?? s.topic ?? "Untitled"}`).join("\n")
        : "No scripts generated yet.";

      // 2c. Pull feedback signals — saved ideas (boost) and disliked ideas (suppress)
      const feedbackRows = await db
        .select({
          topic: ideaFeedback.topic,
          feedback: ideaFeedback.feedback,
          analogDataSource: ideaFeedback.analogDataSource,
        })
        .from(ideaFeedback)
        .orderBy(desc(ideaFeedback.createdAt))
        .limit(50);

      const savedIdeas = feedbackRows.filter((r) => r.feedback === "saved");
      const dislikedIdeas = feedbackRows.filter((r) => r.feedback === "disliked");
      const savedContext = savedIdeas.length > 0
        ? savedIdeas.map((r) => `- ${r.topic}`).join("\n")
        : "None yet.";
      const dislikedContext = dislikedIdeas.length > 0
        ? dislikedIdeas.map((r) => `- ${r.topic}`).join("\n")
        : "None yet.";

      // 2d. FULL MEMORY — every idea suggested in the last 60 days.
      // This is what makes suggestions non-repeating across sessions: the model
      // sees its own prior output, not just the scripts that got generated.
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const priorIdeas = await db
        .select({
          topic: suggestedIdeas.topic,
          status: suggestedIdeas.status,
        })
        .from(suggestedIdeas)
        .where(gte(suggestedIdeas.createdAt, sixtyDaysAgo))
        .orderBy(desc(suggestedIdeas.createdAt))
        .limit(300);

      // Dismissed ideas are the strongest negative signal available — the operator
      // saw the exact idea and rejected it. Keep them in a separate, louder block.
      const dismissedPrior = priorIdeas.filter((r) => r.status === "dismissed");
      const otherPrior = priorIdeas.filter((r) => r.status !== "dismissed");

      const priorIdeasContext = otherPrior.length > 0
        ? otherPrior.map((r) => `- ${r.topic}`).join("\n")
        : "None yet.";
      const dismissedContext = dismissedPrior.length > 0
        ? dismissedPrior.map((r) => `- ${r.topic}`).join("\n")
        : "None yet.";

      // 2e. LIVE RESEARCH LEG — VidIQ keyword research seeded from the operator's
      // own data. Entirely best-effort; never blocks idea generation.
      const MIN_VIDIQ_CREDITS = 30;
      let researchSkipped: string | null = null;
      let researchResults: {
        seedKeyword: string;
        volume: number;
        competition: number;
        opportunityScore: number;
        estimatedMonthlySearch: number;
        related: { keyword: string; overall: number; volume: number }[];
        /** Titles currently overperforming on YouTube for this seed. */
        outlierTitles: { title: string; views: number; outlierScore: number }[];
      }[] = [];

      if (input.skipResearch) {
        researchSkipped = "Research skipped by request.";
      } else {
        // Persona questions are a third seed source after tags and pain points.
        let personaQuestions: string[] = [];
        try {
          const personaRows = await db
            .select({ topQuestions: personas.topQuestions })
            .from(personas)
            .limit(5);
          for (const p of personaRows) {
            const parsed = safeJsonParse<string[]>(p.topQuestions);
            if (Array.isArray(parsed)) personaQuestions.push(...parsed);
          }
        } catch {
          personaQuestions = [];
        }

        const seedKeywords = deriveSeedKeywords(analogRows, personaQuestions, 5);

        if (seedKeywords.length === 0) {
          researchSkipped = "No seed keywords could be derived from analog data or personas.";
        } else {
          // Check the credit balance BEFORE spending anything. Each keyword call
          // costs 5 credits, so a low balance means we skip the whole leg rather
          // than half-completing it.
          let credits: number | null = null;
          try {
            const balance = await vidiqBalance();
            // v2.2 Part 1 fix 5: the live payload has no `credits` key, so this
            // previously coerced undefined to 0 and reported "0 credits" even
            // with thousands available — a false low-balance skip.
            credits = spendableCredits(balance);
          } catch (err) {
            researchSkipped = `VidIQ balance check failed: ${err instanceof Error ? err.message : "unknown error"}`;
          }

          if (researchSkipped === null && credits !== null && credits < MIN_VIDIQ_CREDITS) {
            researchSkipped = `VidIQ credits too low (${credits} < ${MIN_VIDIQ_CREDITS}). Ideas generated from analog data only.`;
          }

          if (researchSkipped === null) {
            const settled = await Promise.allSettled(
              seedKeywords.map(async (kw) => {
                // Keyword research is required for a usable seed; outliers are a
                // bonus signal, so a failure there must not discard the seed.
                const research = await vidiqKeywordResearch(kw, true);

                let outlierTitles: { title: string; views: number; outlierScore: number }[] = [];
                try {
                  const outliers = await vidiqOutliers(kw, 5);
                  outlierTitles = outliers.slice(0, 5).map((o) => ({
                    title: o.title,
                    views: o.viewCount,
                    outlierScore: o.outlierScore,
                  }));
                } catch {
                  outlierTitles = [];
                }

                return {
                  seedKeyword: kw,
                  volume: research.volume,
                  competition: research.competition,
                  opportunityScore: research.overall,
                  estimatedMonthlySearch: research.estimatedMonthlySearch,
                  related: research.related.slice(0, 5).map((r) => ({
                    keyword: r.keyword,
                    overall: r.overall,
                    volume: r.volume,
                  })),
                  outlierTitles,
                };
              })
            );

            researchResults = settled
              .filter((s): s is PromiseFulfilledResult<typeof researchResults[number]> => s.status === "fulfilled")
              .map((s) => s.value);

            if (researchResults.length === 0) {
              researchSkipped = "All VidIQ keyword lookups failed. Ideas generated from analog data only.";
            }
          }
        }
      }

      const researchContext = researchResults.length > 0
        ? [
            "=== KEYWORD & OUTLIER RESEARCH (VidIQ) ===",
            ...researchResults.map((r) => {
              const related = r.related.length > 0
                ? r.related.map((k) => `${k.keyword} (opp ${k.overall})`).join(", ")
                : "none";
              const outliers = r.outlierTitles.length > 0
                ? r.outlierTitles
                    .map((o) => `    • "${o.title}" — ${o.views.toLocaleString()} views, outlier score ${o.outlierScore}`)
                    .join("\n")
                : "    (no outlier data for this seed)";
              return [
                `SEED KEYWORD: "${r.seedKeyword}"`,
                `  Volume: ${r.volume} | Competition: ${r.competition} | Opportunity: ${r.opportunityScore} | Est. monthly searches: ${r.estimatedMonthlySearch}`,
                `  Related high-opportunity keywords: ${related}`,
                `  Currently OVERPERFORMING titles on YouTube for this space:`,
                outliers,
              ].join("\n");
            }),
            "=== END KEYWORD & OUTLIER RESEARCH ===",
          ].join("\n")
                : `No live research available. ${researchSkipped ?? ""}`.trim();

      // Title rule 5: feed real winning titles in as packaging references. These
      // come from the same outlier lookups already performed above, so this adds
      // no extra API cost — it just stops the real signal being wasted on a
      // context block the model reads as trivia rather than as a style target.
      const packagingReferences = buildPackagingReferences(
        researchResults.flatMap((r) => r.outlierTitles.map((o) => o.title))
      );

      // 4. Ask LLM to generate ideas
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a content strategist for Dr. Pedram Shojai (The Urban Monk).
Your job is to suggest ${input.count} high-converting YouTube video ideas.

AUDIENCE: Health-conscious professionals aged 35-55. High-achievers who feel something is missing.
They want: energy, clarity, longevity, stress relief, gut health, sleep, ancient wisdom + modern science.

NORTHSTAR: Base ideas on the ANALOG DATA below (proven converting content). These are sales pages,
ads, and interviews that have already moved this audience to buy. The analog data tells you WHAT
this audience cares about and HOW they respond to messaging.

LIVE RESEARCH (equally important): You are also given a KEYWORD & OUTLIER RESEARCH block showing what
this audience is searching for RIGHT NOW — search volume, competition, opportunity score — plus the
video titles that are currently OVERPERFORMING on YouTube in this space. Analog data tells you what
CONVERTS; research tells you what gets DISCOVERED; outlier titles are live proof of audience demand.
The best ideas sit at the intersection of all three.

BLENDING REQUIREMENT (CRITICAL): Your batch must draw on BOTH sources.
- Every idea must remain grounded in the analog data's proven angles and messaging (NORTHSTAR, above).
- Where research exists, target keywords/angles with HIGH opportunity scores and LOWER competition.
- Treat the overperforming outlier titles as evidence of demand — borrow their ANGLE, never their wording.
- When an idea is research-derived, set the seedKeyword field to the exact seed keyword it came from.
- Never invent search metrics or titles. Only reference keywords that appear in the research block.

GAP ANALYSIS: Avoid topics already well-covered by the published videos listed below.
Prioritize ideas that fill content gaps or approach existing topics from a fresh angle.

DEDUPLICATION (CRITICAL): You will be given a list of scripts ALREADY GENERATED in the library.
Do NOT suggest any topic that is the same as, or substantially similar to, any topic already in the library.
Each idea must be meaningfully distinct — different angle, different pain point, different audience segment.
If the library already has a script on "gut health", do not suggest another gut health script unless it
approaches it from a completely different angle (e.g., gut-brain connection vs. gut microbiome reset).

PERSISTENT MEMORY (CRITICAL): You will ALSO be given every idea already suggested in the last 60 days,
including ideas that were never turned into scripts. Treat that entire list as off-limits — suggesting a
near-duplicate of a previously suggested idea is a failure, even if no script was ever generated from it.
The DISMISSED list is the strongest negative signal you have: the operator saw those exact ideas and
rejected them. Do not resurface them or anything closely resembling them, in topic or in angle.

INTRA-BATCH DIVERSITY (CRITICAL): Within this single batch of ${input.count} ideas, EVERY idea must be
about a DIFFERENT primary topic cluster. Do NOT generate multiple ideas about the same theme (e.g., do not
generate 3 ideas all about "energy" or 2 ideas both about "sleep"). Each idea must cover a distinct domain:
e.g., one about energy, one about gut health, one about stress, one about sleep, one about longevity,
one about morning routines, one about ancient wisdom, one about modern science — spread across the full
spectrum of what this audience cares about. If you find yourself writing two ideas with similar keywords,
stop and replace one with something from a completely different topic cluster.

USER PREFERENCES (training signals from feedback):
- SAVED IDEAS: The user has bookmarked these idea types as interesting — generate more ideas in a similar
  vein (same topic cluster, similar pain points, similar format). Use these as positive signals.
- DISLIKED IDEAS: The user has marked these as "Less Like This" — avoid these topic angles, tones,
  and approaches entirely. These are negative signals — do not echo them even indirectly.

${TITLE_PACKAGING_RULES}

${packagingReferences}

For each idea, return a JSON object with:
- topic: string (the video title, obeying the TITLE PACKAGING RULES above)
- rationale: string (1-2 sentences: why this will convert based on analog data)
- audienceAlignment: number (0-100, how well this matches the audience persona)
- contentGap: string (what gap this fills vs published videos)
- recommendedFormat: string (one of: youtube_script, short_form, email, ad_copy, sales_page_section, podcast_outline)
- recommendedPatterns: string[] (2-4 pattern types from: hook, pain_point, proof_element, objection_handler, cta, story_structure, key_phrase, transformation_arc, authority_signal, social_proof, open_loop)
- analogDataSource: string (which analog entry inspired this, or "audience persona" if no analog data)
- seedKeyword: string (the research keyword behind this idea, or "" if this idea came purely from analog data)

Return a JSON array of ${input.count} ideas. No markdown, no explanation, just the JSON array.`,
          },
          {
            role: "user",
            content: `ANALOG DATA (Northstar — proven converting content):\n${analogContext}\n\n${researchContext}\n\nPUBLISHED VIDEOS (avoid duplicating these):\n${publishedContext}\n\nSCRIPTS ALREADY IN LIBRARY (do NOT repeat or closely echo these topics):\n${existingScriptsContext}\n\nIDEAS ALREADY SUGGESTED IN THE LAST 60 DAYS (do NOT repeat any of these):\n${priorIdeasContext}\n\nPREVIOUSLY DISMISSED IDEAS (strongest negative signal — never resurface these or anything like them):\n${dismissedContext}\n\nSAVED IDEAS (generate more like these):\n${savedContext}\n\nDISLIKED IDEAS (avoid these angles entirely):\n${dislikedContext}\n\nGenerate ${input.count} DISTINCT video ideas that blend proven analog angles with high-opportunity search demand, are not already in the library or the 60-day suggestion history, and avoid all disliked and dismissed angles.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "video_ideas",
            strict: true,
            schema: {
              type: "object",
              properties: {
                ideas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      rationale: { type: "string" },
                      audienceAlignment: { type: "number" },
                      contentGap: { type: "string" },
                      recommendedFormat: { type: "string" },
                      recommendedPatterns: { type: "array", items: { type: "string" } },
                      analogDataSource: { type: "string" },
                      seedKeyword: { type: "string" },
                    },
                    required: ["topic", "rationale", "audienceAlignment", "contentGap", "recommendedFormat", "recommendedPatterns", "analogDataSource", "seedKeyword"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ideas"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      const parsed = parseLLMJson<{ ideas: VideoIdea[] }>(raw);
      const ideas: VideoIdea[] = parsed?.ideas ?? [];

      // ── Persist — this is what makes suggestions survive a page reload ───────
      const batchId = makeBatchId();
      const weekLabel = isoWeekLabel();

      // Resolve the free-text analogDataSource back to a real row id where we can,
      // so the UI can link an idea to the asset that inspired it. Best-effort:
      // a null id simply means the model named something we couldn't match.
      const resolveAnalogId = (sourceText: string | undefined): number | null => {
        if (!sourceText) return null;
        const needle = sourceText.toLowerCase().trim();
        if (!needle || needle === "audience persona") return null;
        const hit = analogRows.find((r) => {
          const title = (r.title ?? "").toLowerCase();
          return title.length > 3 && (needle.includes(title) || title.includes(needle));
        });
        return hit?.id ?? null;
      };

      // Attach the matching research payload when the model cited a seed keyword.
      const resolveResearch = (seed: string | undefined) => {
        if (!seed) return null;
        const needle = seed.toLowerCase().trim();
        if (!needle) return null;
        const hit = researchResults.find(
          (r) =>
            r.seedKeyword.toLowerCase() === needle ||
            r.related.some((k) => k.keyword.toLowerCase() === needle)
        );
        if (!hit) return null;
        return {
          payload: {
            keyword: hit.seedKeyword,
            volume: hit.volume,
            competition: hit.competition,
            opportunityScore: hit.opportunityScore,
            estimatedMonthlySearch: hit.estimatedMonthlySearch,
            topRelatedKeywords: hit.related,
          },
          seedKeyword: hit.seedKeyword,
        };
      };

      let insertedCount = 0;
      if (ideas.length > 0) {
        const rows = ideas
          .filter((idea) => idea.topic && idea.topic.trim().length > 0)
          .map((idea) => {
            const research = resolveResearch((idea as VideoIdea & { seedKeyword?: string }).seedKeyword);
            return {
              batchId,
              weekLabel,
              source: input.source,
              topic: idea.topic.slice(0, 500),
              rationale: idea.rationale ?? null,
              audienceAlignment:
                typeof idea.audienceAlignment === "number" ? Math.round(idea.audienceAlignment) : null,
              contentGap: idea.contentGap ?? null,
              recommendedFormat: idea.recommendedFormat?.slice(0, 64) ?? null,
              recommendedPatterns: Array.isArray(idea.recommendedPatterns) ? idea.recommendedPatterns : [],
              analogDataSource: idea.analogDataSource ?? null,
              analogDataEntryId: resolveAnalogId(idea.analogDataSource),
              vidiqData: research?.payload ?? null,
              seedKeyword: research?.seedKeyword?.slice(0, 255) ?? null,
              status: "suggested" as const,
            };
          });

        if (rows.length > 0) {
          await db.insert(suggestedIdeas).values(rows);
          insertedCount = rows.length;
        }
      }

      // Read the batch back so the client receives real row ids to act on.
      // JSON columns arrive as strings from the driver, so normalise them here
      // for the same reason as `listSuggestedIdeas` (see `parseJsonColumn`).
      const savedRawRows = insertedCount > 0
        ? await db
            .select()
            .from(suggestedIdeas)
            .where(eq(suggestedIdeas.batchId, batchId))
            .orderBy(desc(suggestedIdeas.audienceAlignment))
        : [];
      const savedRows = savedRawRows.map((r) => ({
        ...r,
        recommendedPatterns: parseJsonColumn<string[]>(r.recommendedPatterns, []),
        vidiqData: parseJsonColumn<typeof r.vidiqData>(r.vidiqData, null),
      }));

      return {
        // Kept for backward compatibility with any existing caller.
        ideas,
        // The persisted rows — what the v2 UI actually renders.
        savedIdeas: savedRows,
        batchId,
        weekLabel,
        analogDataCount: analogRows.length,
        publishedVideoCount: publishedVideos.length,
        researchSeedCount: researchResults.length,
        /** True when the VidIQ research leg did not contribute (see `reason`). */
        researchSkipped: researchSkipped !== null,
        reason: researchSkipped,
      };
    }),

  // ─── Supercharge ideas with VidIQ keyword data ────────────────────────────
  /**
   * Takes a list of video idea topics and runs VidIQ keyword research on each.
   * Returns the original ideas enriched with search volume, competition,
   * opportunity score, and top related keywords.
   * Cost: 5 VidIQ credits per idea.
   */
  superchargeIdeas: protectedProcedure
    .input(z.object({
      // v2.1 Bug C item 3 — ids, not whole objects. The old signature accepted
      // detached idea payloads, which made persistence impossible: there was no
      // row to write the enrichment back to, so every result evaporated when the
      // component unmounted and the credits were spent for nothing.
      ideaIds: z.array(z.number()).min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(suggestedIdeas)
        .where(inArray(suggestedIdeas.id, input.ideaIds));

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No matching ideas found" });
      }

      // v2.1 Bug C item 5 — idempotency. Re-enriching an idea that already has
      // VidIQ data burns 5 credits to overwrite identical numbers, so skip it.
      const alreadyEnriched = rows.filter((r) => r.vidiqData !== null).map((r) => r.id);
      const pending = rows.filter((r) => r.vidiqData === null);

      // v2.1 Bug C item 4 — check the balance BEFORE spending. Discovering an
      // exhausted quota five ideas into a loop wastes both time and credits.
      const CREDITS_PER_IDEA = 5;
      let balanceBefore: number | null = null;
      if (pending.length > 0) {
        try {
          const bal = await vidiqBalance();
          // v2.2 Part 1 fix 5: `bal.credits` was always undefined, so
          // balanceBefore stayed null and this guard could never stop a batch.
          balanceBefore = spendableCredits(bal);
          const needed = pending.length * CREDITS_PER_IDEA;
          if (balanceBefore !== null && balanceBefore < needed) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                `VidIQ credits too low: ${balanceBefore} available, ${needed} needed ` +
                `for ${pending.length} idea(s) at ${CREDITS_PER_IDEA} each.`,
            });
          }
        } catch (err) {
          // A balance endpoint that is itself down must not block the operator;
          // only a *confirmed* shortfall is a hard stop.
          if (err instanceof TRPCError) throw err;
          console.warn("[ScriptFactory] VidIQ balance pre-check unavailable:", err);
        }
      }

      // v2.1 Bug C item 2 — a wall-clock budget across the whole batch. Per-call
      // timeouts alone still allow 20 ideas x 20s = 6.7 minutes of hanging.
      const BATCH_BUDGET_MS = 90_000;
      const startedAt = Date.now();

      const enrichedIds: number[] = [];
      const failedIds: number[] = [];
      const skippedForTime: number[] = [];
      const errors: { ideaId: number; error: string }[] = [];

      for (const idea of pending) {
        if (Date.now() - startedAt > BATCH_BUDGET_MS) {
          // Out of budget: report the remainder honestly instead of hanging.
          skippedForTime.push(idea.id);
          continue;
        }

        const keyword = normalizeKeyword(idea.topic);
        try {
          const research = await vidiqKeywordResearch(keyword, true);
          const payload = {
            keyword: research.keyword,
            volume: research.volume,
            competition: research.competition,
            opportunityScore: research.overall,
            estimatedMonthlySearch: research.estimatedMonthlySearch,
            topRelatedKeywords: research.related
              .slice(0, 5)
              .map((r) => ({ keyword: r.keyword, overall: r.overall, volume: r.volume })),
          };

          // Persist immediately, one idea at a time. Writing per-iteration rather
          // than after the loop means a later failure or timeout cannot discard
          // credits already spent on earlier successes.
          await db
            .update(suggestedIdeas)
            .set({ vidiqData: payload, seedKeyword: keyword, updatedAt: new Date() })
            .where(eq(suggestedIdeas.id, idea.id));

          enrichedIds.push(idea.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[ScriptFactory] supercharge failed for idea ${idea.id}: ${msg}`);
          failedIds.push(idea.id);
          errors.push({ ideaId: idea.id, error: msg.slice(0, 200) });
        }
      }

      return {
        requested: input.ideaIds.length,
        enrichedIds,
        failedIds,
        skippedForTime,
        alreadyEnriched,
        creditsSpent: enrichedIds.length * CREDITS_PER_IDEA,
        balanceBefore,
        elapsedMs: Date.now() - startedAt,
        errors,
      };
    }),

  // ─── Get stats ────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, approved: 0, avgVerificationPct: 0 };

    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        approved: sql<number>`SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)`,
        avgVerificationPct: sql<number>`AVG(verification_pct)`,
      })
      .from(scriptFactoryOutputs);

    return {
      total: Number(stats?.total ?? 0),
      approved: Number(stats?.approved ?? 0),
      avgVerificationPct: Number(stats?.avgVerificationPct ?? 0),
    };
  }),

  // ─── List persisted suggested ideas (the idea inbox) ──────────────────────
  /**
   * Returns ideas grouped the way the operator works:
   *   • thisWeek   — suggested in the current ISO week and still undecided
   *   • shortlist  — ideas explicitly kept, regardless of age
   *   • dismissed  — rejected ideas, newest first (for the collapsed count)
   *   • generated  — ideas that already produced a script
   *
   * Grouping happens server-side so every client renders identical buckets.
   */
  listSuggestedIdeas: protectedProcedure
    .input(z.object({
      status: z.enum(["suggested", "shortlisted", "dismissed", "generated", "all"]).default("all"),
      weekLabel: z.string().max(16).optional(),
      limit: z.number().min(1).max(500).default(200),
      offset: z.number().min(0).default(0),
    }).default({ status: "all", limit: 200, offset: 0 }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return {
          ideas: [], thisWeek: [], shortlist: [], dismissed: [], generated: [],
          weekLabel: isoWeekLabel(),
          counts: { thisWeek: 0, shortlist: 0, dismissed: 0, generated: 0 },
        };
      }

      const weekLabel = input.weekLabel ?? isoWeekLabel();

      const rawRows = await db
        .select()
        .from(suggestedIdeas)
        .where(input.status === "all" ? undefined : eq(suggestedIdeas.status, input.status))
        .orderBy(desc(suggestedIdeas.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // The MySQL driver hands JSON columns back as raw strings, so Drizzle's
      // declared `$type<string[]>()` is a compile-time claim the runtime does not
      // honour. Normalising here (the codebase-wide idiom) means every consumer
      // receives real arrays/objects and never a JSON string.
      const rows = rawRows.map((r) => ({
        ...r,
        recommendedPatterns: parseJsonColumn<string[]>(r.recommendedPatterns, []),
        vidiqData: parseJsonColumn<typeof r.vidiqData>(r.vidiqData, null),
      }));

      // A shortlisted idea stays in the shortlist even after its week ends, so
      // "this week" deliberately excludes rows the operator already decided on.
      const thisWeek = rows.filter((r) => r.weekLabel === weekLabel && r.status === "suggested");
      const shortlist = rows.filter((r) => r.status === "shortlisted");
      const dismissed = rows.filter((r) => r.status === "dismissed");
      const generated = rows.filter((r) => r.status === "generated");

      return {
        /** Flat list honouring `status`/`limit`/`offset` — for filtered callers. */
        ideas: rows,
        thisWeek,
        shortlist,
        dismissed,
        generated,
        weekLabel,
        counts: {
          thisWeek: thisWeek.length,
          shortlist: shortlist.length,
          dismissed: dismissed.length,
          generated: generated.length,
        },
      };
    }),

  // ─── Update the status of a persisted idea ──────────────────────────────
  /**
   * Moves an idea between buckets (shortlist / dismiss / restore).
   *
   * Operator judgements are mirrored into `idea_feedback` — shortlist → `saved`,
   * dismiss → `disliked` — so the existing LLM training-signal path keeps working
   * and the two systems cannot drift apart.
   */
  updateIdeaStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["suggested", "shortlisted", "dismissed", "generated"]),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [idea] = await db
        .select()
        .from(suggestedIdeas)
        .where(eq(suggestedIdeas.id, input.id))
        .limit(1);

      if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: `Idea ${input.id} not found` });

      await db
        .update(suggestedIdeas)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(suggestedIdeas.id, input.id));

      if (input.status === "shortlisted" || input.status === "dismissed") {
        await db.insert(ideaFeedback).values({
          topic: idea.topic,
          rationale: idea.rationale ?? null,
          audienceAlignment: idea.audienceAlignment ?? null,
          recommendedFormat: idea.recommendedFormat ?? null,
          // `idea_feedback.recommendedPatterns` is a TEXT column holding JSON, while
          // the driver may hand us either a raw string (JSON column) or a parsed
          // array. Normalising first prevents double-encoding (`"\"[...]\""`).
          recommendedPatterns: (() => {
            const patterns = parseJsonColumn<string[]>(idea.recommendedPatterns, []);
            return patterns.length > 0 ? JSON.stringify(patterns) : null;
          })(),
          analogDataSource: idea.analogDataSource ?? null,
          feedback: input.status === "shortlisted" ? "saved" : "disliked",
          note: input.note ?? null,
        });
      }

      return { success: true, id: input.id, status: input.status };
    }),

  // ─── Repair orphaned "generated" stamps (v2.1 Bug A item 5) ───────────────
  /**
   * An idea stamped `generated` whose `generatedScriptId` points at a script row
   * that no longer exists is an *orphan*: the operator sees "already generated"
   * but there is nothing to open. Deleting a script is the normal way to create
   * one (the delete procedure does not unlink its ideas).
   *
   * Resetting them to `shortlisted` (rather than `suggested`) preserves the
   * operator's original intent — they had chosen this idea — and puts it straight
   * back into the staging queue so it can be regenerated.
   *
   * Idempotent: running it twice finds zero orphans the second time.
   */
  repairOrphanedIdeas: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const stamped = await db
        .select({ id: suggestedIdeas.id, topic: suggestedIdeas.topic, scriptId: suggestedIdeas.generatedScriptId })
        .from(suggestedIdeas)
        .where(eq(suggestedIdeas.status, "generated"));

      const orphans: { ideaId: number; topic: string; missingScriptId: number | null }[] = [];

      for (const row of stamped) {
        // A `generated` stamp with no script id at all is also an orphan.
        if (!row.scriptId) {
          orphans.push({ ideaId: row.id, topic: row.topic, missingScriptId: null });
          continue;
        }
        const [script] = await db
          .select({ id: scriptFactoryOutputs.id })
          .from(scriptFactoryOutputs)
          .where(eq(scriptFactoryOutputs.id, row.scriptId))
          .limit(1);
        if (!script) {
          orphans.push({ ideaId: row.id, topic: row.topic, missingScriptId: row.scriptId });
        }
      }

      for (const orphan of orphans) {
        await db
          .update(suggestedIdeas)
          .set({ status: "shortlisted", generatedScriptId: null, updatedAt: new Date() })
          .where(eq(suggestedIdeas.id, orphan.ideaId));
      }

      console.log(
        `[ScriptFactory] Orphan repair: checked ${stamped.length} generated ideas, reset ${orphans.length}.`
      );

      return { checked: stamped.length, repaired: orphans.length, orphans };
    }),

  // ─── Record idea feedback (legacy-compatible, now status-syncing) ─────────
  /**
   * v2 additionally maps the feedback onto the persisted idea's status
   * (`saved` → shortlisted, `disliked` → dismissed). `ideaId` is optional: when
   * omitted we match on the exact topic string so older clients keep working.
   */
  recordIdeaFeedback: protectedProcedure
    .input(z.object({
      ideaId: z.number().optional(),
      topic: z.string().min(1).max(500),
      rationale: z.string().optional(),
      audienceAlignment: z.number().min(0).max(100).optional(),
      recommendedFormat: z.string().optional(),
      recommendedPatterns: z.array(z.string()).optional(),
      analogDataSource: z.string().optional(),
      feedback: z.enum(["saved", "disliked"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.insert(ideaFeedback).values({
        topic: input.topic,
        rationale: input.rationale ?? null,
        audienceAlignment: input.audienceAlignment ?? null,
        recommendedFormat: input.recommendedFormat ?? null,
        recommendedPatterns: input.recommendedPatterns ? JSON.stringify(input.recommendedPatterns) : null,
        analogDataSource: input.analogDataSource ?? null,
        feedback: input.feedback,
        note: input.note ?? null,
      });

      // Keep the persisted idea's status in sync with the feedback just given.
      const newStatus = input.feedback === "saved" ? ("shortlisted" as const) : ("dismissed" as const);
      let syncedIdeaId: number | null = null;

      if (input.ideaId) {
        await db
          .update(suggestedIdeas)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(suggestedIdeas.id, input.ideaId));
        syncedIdeaId = input.ideaId;
      } else {
        // No id supplied — fall back to the newest idea with this exact topic.
        const [match] = await db
          .select({ id: suggestedIdeas.id })
          .from(suggestedIdeas)
          .where(eq(suggestedIdeas.topic, input.topic.slice(0, 500)))
          .orderBy(desc(suggestedIdeas.createdAt))
          .limit(1);
        if (match) {
          await db
            .update(suggestedIdeas)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(suggestedIdeas.id, match.id));
          syncedIdeaId = match.id;
        }
      }

      return { success: true, syncedIdeaId, syncedStatus: syncedIdeaId ? newStatus : null };
    }),

  // ─── List saved ideas ───────────────────────────────────────────────────
  listSavedIdeas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { saved: [], disliked: [] };

    const rows = await db
      .select()
      .from(ideaFeedback)
      .orderBy(desc(ideaFeedback.createdAt))
      .limit(100);

    return {
      saved: rows.filter((r) => r.feedback === "saved"),
      disliked: rows.filter((r) => r.feedback === "disliked"),
    };
  }),
});

// Export for tests
export { SCRIPT_FORMATS, FORMAT_DESCRIPTIONS };
