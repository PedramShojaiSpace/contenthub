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
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";
import { vidiqBalance, vidiqKeywordResearch, vidiqOutliers, vidiqTrendingVideos, type VidIQOutlierVideo } from "./vidiq";
import { getAvatarContextBlockForPersona } from "./avatarRouter";
import { searchCorpusEntries } from "./corpusRouter";
import { fetchTranscriptWithQuota } from "./transcriptRouter";
import { extractPatternsFromContent } from "./patternExtractorRouter";
import {
  buildLengthInstruction,
  countWords,
  deriveSeedKeywords,
  isoWeekLabel,
  makeBatchId,
  normalizeKeyword,
  parseJsonColumn,
  safeJsonParse,
  wordBudget,
} from "./scriptFactoryHelpers";

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
}

const EMPTY_RESEARCH: ResolvedResearch = {
  jobId: null,
  context: "",
  patternIds: [],
  outlierCount: 0,
  transcriptCount: 0,
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

    const outliers = (job.outlierVideos ?? []) as StoredOutlier[];
    const videoIds = (job.transcriptVideoIds ?? []) as string[];

    // Transcripts are read back from the cache the job populated, so no
    // additional Supadata units are ever spent at generation time.
    let transcripts: { title: string; text: string }[] = [];
    if (videoIds.length > 0) {
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

    return {
      jobId: job.id,
      context: buildResearchContext(outliers, transcripts),
      patternIds: (job.patternIds ?? []) as number[],
      outlierCount: outliers.length,
      transcriptCount: transcripts.length,
    };
  } catch (err) {
    console.error("[ScriptFactory] resolveResearchContext failed:", err);
    return EMPTY_RESEARCH;
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
  } = {}
): string {
  const { persona, lengthInstruction } = opts;

  // Default demographic line, replaced wholesale when a persona is selected.
  const audienceLine = persona?.audienceLine
    ?? "Audience: health-conscious\nprofessionals aged 35-55 who are high-achievers but feel something is missing.";

  const personaSection = persona?.block ? `\n${persona.block}\n` : "";
  const lengthSection = lengthInstruction ? `\n${lengthInstruction}\n` : "";

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

SCRIPT STRUCTURE TAGS (use these to label each section):
[HOOK] — opening hook (first 15 seconds / first line)
[PAIN] — pain point identification
[PROOF] — proof element or authority signal
[STORY] — story or transformation arc
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
      let explicitNorthStar: { title: string | null; content: string; type: string | null }[] = [];
      if (northStarIds.length > 0) {
        const rows = await db
          .select({
            id: analogDataEntries.id,
            title: analogDataEntries.title,
            content: analogDataEntries.content,
            type: analogDataEntries.type,
          })
          .from(analogDataEntries)
          .where(inArray(analogDataEntries.id, northStarIds));
        // Preserve the operator's ordering — the first pick is the primary model.
        explicitNorthStar = northStarIds
          .map((id) => rows.find((r) => r.id === id))
          .filter((r): r is typeof rows[number] => Boolean(r))
          .map((r) => ({ title: r.title, content: r.content, type: r.type }));
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
      const research = await resolveResearchContext(db, {
        useDeepResearch: input.useDeepResearch,
        researchJobId: input.researchJobId,
        topic: input.topic,
      });

      // Patterns mined from the research job join the pool for this script.
      let researchPatterns: typeof contentPatterns.$inferSelect[] = [];
      if (research.patternIds.length > 0) {
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
        const firstPassWords = countWords(scriptBody);
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

      // 7b. Close the loop on the originating idea (Phase 2.3.5). Best-effort:
      //     the script is already saved, so a bookkeeping failure must not
      //     surface as a generation failure.
      if (input.sourceIdeaId && insertId > 0) {
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
        retrievalMethod,
        personaName: personaContext?.name ?? null,
        northStarCount: explicitNorthStar.length,
        northStarTitles: explicitNorthStar.map((e) => e.title ?? "Untitled"),
        researchJobId: research.jobId ?? null,
        researchOutliersUsed: research.outlierCount,
        researchTranscriptsUsed: research.transcriptCount,
        researchPatternsUsed: researchPatterns.length,
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

      // The keyword actually sent to VidIQ: an explicit seed when the idea
      // engine supplied one, else a normalized form of the topic.
      const seedKeyword = (input.seedKeyword && normalizeKeyword(input.seedKeyword))
        || normalizeKeyword(input.topic);

      const jobInsert = await db.insert(researchJobs).values({
        topic: input.topic.slice(0, 500),
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

        // Rank by outlier score first, then raw views. `channelId` and
        // `subscriberCount` are absent from VidIQ's payload (see schema note),
        // so they are stored null rather than fabricated.
        const outlierVideos: StoredOutlier[] = rawOutliers
          .filter((v) => v && v.videoId)
          .map((v) => ({
            videoId: String(v.videoId),
            title: String(v.title ?? "Untitled"),
            channelId: null,
            channelTitle: String(v.channelTitle ?? "Unknown channel"),
            views: Number(v.viewCount ?? 0),
            subscriberCount: null,
            outlierScore: Number(v.outlierScore ?? 0),
            publishedAt: v.publishedAt ? String(v.publishedAt) : null,
          }))
          .sort((a, b) => (b.outlierScore - a.outlierScore) || (b.views - a.views));

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

        for (const video of outlierVideos.slice(0, input.maxTranscripts)) {
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

        const notes = [
          `discovery=${discoverySource}`,
          `seed="${seedKeyword}"`,
          `outliers=${outlierVideos.length}`,
          `transcripts=${secured.length}`,
          `patterns=${patternIds.length}`,
          quotaBlocked ? "quota_blocked=true" : null,
        ].filter(Boolean).join("; ");

        await setStatus("complete", {
          outlierVideos,
          transcriptVideoIds,
          patternIds,
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Research failed: ${msg}` });
      }
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

      const outliers = (job.outlierVideos ?? []) as StoredOutlier[];
      return {
        id: job.id,
        topic: job.topic,
        seedKeyword: job.seedKeyword,
        status: job.status,
        outlierVideos: outliers,
        outlierCount: outliers.length,
        transcriptVideoIds: (job.transcriptVideoIds ?? []) as string[],
        patternIds: (job.patternIds ?? []) as number[],
        patternCount: ((job.patternIds ?? []) as number[]).length,
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
            credits = Number(balance?.credits ?? 0);
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

For each idea, return a JSON object with:
- topic: string (the video title/topic, 60-80 chars, compelling and specific)
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
      ideas: z.array(z.object({
        topic: z.string(),
        rationale: z.string(),
        audienceAlignment: z.number(),
        contentGap: z.string(),
        recommendedFormat: z.string(),
        recommendedPatterns: z.array(z.string()),
        analogDataSource: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const enriched: SuperchargedIdea[] = [];

      for (const idea of input.ideas) {
        try {
          // Extract a clean keyword from the topic (first 5 words work well for VidIQ)
          const keyword = idea.topic.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/).slice(0, 6).join(" ");
          const research = await vidiqKeywordResearch(keyword, true);

          enriched.push({
            ...idea,
            vidiq: {
              keyword: research.keyword,
              volume: research.volume,
              competition: research.competition,
              opportunityScore: research.overall,
              estimatedMonthlySearch: research.estimatedMonthlySearch,
              topRelatedKeywords: research.related
                .slice(0, 5)
                .map((r) => ({ keyword: r.keyword, overall: r.overall, volume: r.volume })),
            },
          });
        } catch {
          // VidIQ failed for this idea — include it without metrics
          enriched.push({
            ...idea,
            vidiq: null,
          });
        }
      }

      return { ideas: enriched };
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
