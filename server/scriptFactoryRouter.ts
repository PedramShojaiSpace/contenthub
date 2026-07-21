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
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { analogDataEntries, contentPatterns, corpusEntries, ideaFeedback, scriptFactoryOutputs, scriptPerformanceFeedback, videoJobs } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";
import { vidiqKeywordResearch } from "./vidiq";

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
  externalTranscripts: { title: string; transcript: string; viewCount: number }[] = []
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

  if (corpusExcerpts.length > 0) {
    // Sort: analog_data (Northstar) first, transcripts second
    const analogEntries = corpusExcerpts.filter(e => e.sourceType === "analog_data");
    const transcriptEntries = corpusExcerpts.filter(e => e.sourceType !== "analog_data");


    if (analogEntries.length > 0) {
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

  return lines.join("\n");
}

/**
 * Build the script generation system prompt.
 */
function buildSystemPrompt(format: ScriptFormat, groundedContext: string): string {
  return `You are a direct-response copywriter for Dr. Pedram Shojai (The Urban Monk).
Your job is to write a ${FORMAT_DESCRIPTIONS[format]} that is grounded in proven, converting content.

VOICE: Dr. Pedram Shojai's voice — bridges ancient wisdom with modern science, challenges the status quo,
empathetic but direct, authoritative, personal storytelling, never preachy. Audience: health-conscious
professionals aged 35-55 who are high-achievers but feel something is missing.

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
- Start directly with [HOOK]

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
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

      // 2. Pull corpus excerpts (keyword search on topic if no vector)
      let corpusExcerpts: { title: string | null; content: string; sourceType: string; id: number }[] = [];
      const usedCorpusIds: number[] = [];

      if (input.useCorpusSearch) {
        try {
          // Build keyword OR conditions using proper Drizzle sql tagged templates
          const topicWords = input.topic.trim().split(/\s+/).slice(0, 5).filter(Boolean);
          const keywordCondition = topicWords.length > 0
            ? or(...topicWords.map((w) => or(
                sql`${corpusEntries.content} LIKE ${`%${w}%`}`,
                sql`${corpusEntries.title} LIKE ${`%${w}%`}`
              )))
            : undefined;

          // NORTHSTAR PRIORITY: Pull analog_data entries first (proven converting content)
          // These are sales pages, ads, interviews — the primary source of truth
          const analogRows = await db
            .select({ id: corpusEntries.id, title: corpusEntries.title, content: corpusEntries.content, sourceType: corpusEntries.sourceType })
            .from(corpusEntries)
            .where(and(eq(corpusEntries.inCorpus, 1), eq(corpusEntries.sourceType, "analog_data"), keywordCondition))
            .orderBy(desc(corpusEntries.createdAt))
            .limit(3);

          // SECONDARY: Fill remaining slots with transcripts (context only, not Northstar)
          const remainingSlots = Math.max(0, 5 - analogRows.length);
          let transcriptRows: typeof analogRows = [];
          if (remainingSlots > 0) {
            transcriptRows = await db
              .select({ id: corpusEntries.id, title: corpusEntries.title, content: corpusEntries.content, sourceType: corpusEntries.sourceType })
              .from(corpusEntries)
              .where(and(eq(corpusEntries.inCorpus, 1), eq(corpusEntries.sourceType, "transcript"), keywordCondition))
              .orderBy(desc(corpusEntries.createdAt))
              .limit(remainingSlots);
          }

          // Analog data always comes first in the array (Northstar ordering)
          corpusExcerpts = [...analogRows, ...transcriptRows];
          usedCorpusIds.push(...corpusExcerpts.map((r) => r.id));
        } catch {
          // Fallback: get recent corpus entries, analog_data first
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

      // 3. Fetch relevant YouTube transcripts via Supadata (secondary reference)
      // These run in parallel with the corpus search and are injected as secondary context.
      // They never block generation — if Supadata fails, we proceed without them.
      const externalTranscripts = await fetchRelevantTranscripts(input.topic, 3);

      // 3b. Build grounded context (analog data Northstar + corpus + external transcripts)
      const groundedContext = buildGroundedContext(allPatterns, corpusExcerpts, externalTranscripts);
      const systemPrompt = buildSystemPrompt(input.format, groundedContext);

      // 4. Generate script via LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write a ${FORMAT_DESCRIPTIONS[input.format]} about the following topic:\n\n${input.topic}\n\nRemember to tag verified elements with [VERIFIED] inline.`,
          },
        ],
      });

      const scriptBody = String(response?.choices?.[0]?.message?.content ?? "");
      if (!scriptBody || scriptBody.length < 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty script" });
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
      });

      const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId ?? 0;

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
        id: Number(insertId),
        title,
        scriptBody: cleanScriptBody,
        verifiedCount: verified,
        totalElements: total,
        verificationPct: pct,
        patternsUsed: allPatterns.length,
        corpusEntriesUsed: corpusExcerpts.length,
        externalTranscriptsUsed: externalTranscripts.length,
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

  // ─── Suggest video ideas from analog data ─────────────────────────────────
  /**
   * Reads analog data entries + published video titles, then asks the LLM
   * to suggest 5-8 content ideas that:
   *  - Are grounded in proven converting topics from the analog data
   *  - Fill gaps not already covered by published videos
   *  - Are aligned with the Urban Monk audience persona
   */
  suggestIdeas: protectedProcedure
    .input(z.object({
      count: z.number().min(3).max(10).default(6),
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
      const existingScriptsContext = existingScripts.length > 0
        ? existingScripts.map((s) => `- ${s.topic ?? s.title ?? "Untitled"}`).join("\n")
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

GAP ANALYSIS: Avoid topics already well-covered by the published videos listed below.
Prioritize ideas that fill content gaps or approach existing topics from a fresh angle.

DEDUPLICATION (CRITICAL): You will be given a list of scripts ALREADY GENERATED in the library.
Do NOT suggest any topic that is the same as, or substantially similar to, any topic already in the library.
Each idea must be meaningfully distinct — different angle, different pain point, different audience segment.
If the library already has a script on "gut health", do not suggest another gut health script unless it
approaches it from a completely different angle (e.g., gut-brain connection vs. gut microbiome reset).

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

Return a JSON array of ${input.count} ideas. No markdown, no explanation, just the JSON array.`,
          },
          {
            role: "user",
            content: `ANALOG DATA (Northstar — proven converting content):\n${analogContext}\n\nPUBLISHED VIDEOS (avoid duplicating these):\n${publishedContext}\n\nSCRIPTS ALREADY IN LIBRARY (do NOT repeat or closely echo these topics):\n${existingScriptsContext}\n\nSAVED IDEAS (generate more like these):\n${savedContext}\n\nDISLIKED IDEAS (avoid these angles entirely):\n${dislikedContext}\n\nGenerate ${input.count} DISTINCT video ideas that are not already in the library and avoid disliked angles.`,
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
                    },
                    required: ["topic", "rationale", "audienceAlignment", "contentGap", "recommendedFormat", "recommendedPatterns", "analogDataSource"],
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

      return {
        ideas,
        analogDataCount: analogRows.length,
        publishedVideoCount: publishedVideos.length,
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

  // ─── Record idea feedback (Save for Later / Less Like This) ────────────────────
  recordIdeaFeedback: protectedProcedure
    .input(z.object({
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

      return { success: true };
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
