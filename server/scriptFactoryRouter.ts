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

import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { contentPatterns, corpusEntries, scriptFactoryOutputs, scriptPerformanceFeedback } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";

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
  corpusExcerpts: { title: string | null; content: string; sourceType: string }[]
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
    lines.push("=== CORPUS REFERENCE EXCERPTS ===");
    lines.push("These are excerpts from proven content. Draw from them for language, structure, and framing.");
    lines.push("");
    for (const entry of corpusExcerpts.slice(0, 3)) {
      lines.push(`[${entry.sourceType.toUpperCase()}] ${entry.title ?? "Untitled"}`);
      lines.push(entry.content.slice(0, 800));
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
          const rows = await db
            .select({ id: corpusEntries.id, title: corpusEntries.title, content: corpusEntries.content, sourceType: corpusEntries.sourceType })
            .from(corpusEntries)
            .where(and(eq(corpusEntries.inCorpus, 1), keywordCondition))
            .orderBy(desc(corpusEntries.createdAt))
            .limit(5);
          corpusExcerpts = rows;
          usedCorpusIds.push(...rows.map((r) => r.id));
        } catch {
          // Fallback: just get recent corpus entries
          const rows = await db
            .select({ id: corpusEntries.id, title: corpusEntries.title, content: corpusEntries.content, sourceType: corpusEntries.sourceType })
            .from(corpusEntries)
            .where(eq(corpusEntries.inCorpus, 1))
            .orderBy(desc(corpusEntries.createdAt))
            .limit(3);
          corpusExcerpts = rows;
          usedCorpusIds.push(...rows.map((r) => r.id));
        }
      }

      // 3. Build grounded context
      const groundedContext = buildGroundedContext(allPatterns, corpusExcerpts);
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

      const scriptBody = response?.choices?.[0]?.message?.content ?? "";
      if (!scriptBody || scriptBody.length < 50) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty script" });
      }

      // 5. Count [VERIFIED] tags
      const { verified, total, pct } = countVerifiedTags(scriptBody);

      // 6. Generate title
      const titleResponse = await invokeLLM({
        messages: [
          { role: "system", content: "Generate a concise, compelling title for this script. Return only the title, nothing else. Max 80 characters." },
          { role: "user", content: `Topic: ${input.topic}\nFormat: ${input.format}\n\nFirst 200 chars of script:\n${scriptBody.slice(0, 200)}` },
        ],
      });
      const title = (titleResponse?.choices?.[0]?.message?.content ?? input.topic).slice(0, 500).trim();

      // 7. Save to DB
      const insertResult = await db.insert(scriptFactoryOutputs).values({
        title,
        topic: input.topic,
        format: input.format,
        scriptBody,
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
        scriptBody,
        verifiedCount: verified,
        totalElements: total,
        verificationPct: pct,
        patternsUsed: allPatterns.length,
        corpusEntriesUsed: corpusExcerpts.length,
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
});

// Export for tests
export { SCRIPT_FORMATS, FORMAT_DESCRIPTIONS };
