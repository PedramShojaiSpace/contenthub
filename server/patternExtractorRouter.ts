/**
 * Pattern Extractor Router — Phase D
 *
 * Mines content patterns from corpus entries using LLM analysis.
 *
 * Pattern types extracted:
 *   hook, pain_point, proof_element, objection_handler, cta,
 *   story_structure, key_phrase, transformation_arc,
 *   authority_signal, social_proof, open_loop, other
 *
 * Effectiveness score = normalized outlier score of the source video (0–1).
 * For analog data entries, effectiveness_score defaults to 0.8 (assumed converting).
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { contentPatterns, corpusEntries } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

const PATTERN_TYPES = [
  "hook", "pain_point", "proof_element", "objection_handler",
  "cta", "story_structure", "key_phrase", "transformation_arc",
  "authority_signal", "social_proof", "open_loop", "other",
] as const;

type PatternType = typeof PATTERN_TYPES[number];

interface ExtractedPattern {
  type: PatternType;
  text: string;
  context: string;
}

// ─── LLM extraction ───────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a direct-response copywriting analyst specializing in health and wellness content.
Your job is to extract persuasion patterns from high-performing content transcripts and sales copy.

Extract ONLY patterns that are genuinely present in the text. Do not invent patterns.

For each pattern found, return:
- type: one of [hook, pain_point, proof_element, objection_handler, cta, story_structure, key_phrase, transformation_arc, authority_signal, social_proof, open_loop, other]
- text: the exact pattern or phrase (verbatim where possible, max 300 chars)
- context: 1-2 sentences of surrounding context explaining why this is effective (max 200 chars)

Return a JSON object with a single key "patterns" containing an array of pattern objects.
Extract between 5 and 20 patterns per piece of content. Focus on the most impactful ones.`;

async function extractPatternsFromContent(
  content: string,
  title: string | null
): Promise<ExtractedPattern[]> {
  const chunk = content.slice(0, 6000); // Use first 6000 chars for pattern extraction

  const response = await invokeLLM({
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract persuasion patterns from this content:\n\nTitle: ${title ?? "Untitled"}\n\n---\n\n${chunk}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pattern_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            patterns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  text: { type: "string" },
                  context: { type: "string" },
                },
                required: ["type", "text", "context"],
                additionalProperties: false,
              },
            },
          },
          required: ["patterns"],
          additionalProperties: false,
        },
      },
    },
  });

  const content_str = response?.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseLLMJson<{ patterns: ExtractedPattern[] }>(content_str);
  if (!parsed?.patterns || !Array.isArray(parsed.patterns)) return [];

  return parsed.patterns
    .filter((p) => p.text && p.text.length > 5)
    .map((p) => ({
      type: (PATTERN_TYPES.includes(p.type as PatternType) ? p.type : "other") as PatternType,
      text: String(p.text).slice(0, 300),
      context: String(p.context ?? "").slice(0, 200),
    }));
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const patternExtractorRouter = router({

  // ─── Extract patterns from a single corpus entry ──────────────────────────
  extractFromEntry: protectedProcedure
    .input(z.object({
      corpusEntryId: z.number(),
      overwrite: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [entry] = await db
        .select()
        .from(corpusEntries)
        .where(eq(corpusEntries.id, input.corpusEntryId))
        .limit(1);

      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Corpus entry not found" });

      // Check if already extracted
      if (!input.overwrite) {
        const [existing] = await db
          .select({ id: contentPatterns.id })
          .from(contentPatterns)
          .where(eq(contentPatterns.sourceCorpusId, input.corpusEntryId))
          .limit(1);
        if (existing) return { extracted: 0, skipped: true };
      }

      // Get effectiveness score from outlier data if transcript
      let effectivenessScore = 0.8; // default for analog data
      if (entry.sourceType === "transcript" && entry.sourceId) {
        const outlierRows = await db.execute(
          sql`SELECT outlier_score FROM yt_video_outliers WHERE video_id = ${entry.sourceId} LIMIT 1`
        ) as unknown as { rows: { outlier_score: number }[] };
        const rows = (outlierRows as any).rows ?? (outlierRows as any) ?? [];
        if (rows[0]?.outlier_score) {
          // Normalize: outlier_score typically 0-5, cap at 1.0
          effectivenessScore = Math.min(1.0, Number(rows[0].outlier_score) / 3.0);
        }
      }

      // Extract patterns via LLM
      const patterns = await extractPatternsFromContent(entry.content, entry.title);
      if (patterns.length === 0) return { extracted: 0, skipped: false };

      // Delete existing if overwriting
      if (input.overwrite) {
        await db.delete(contentPatterns).where(eq(contentPatterns.sourceCorpusId, input.corpusEntryId));
      }

      // Insert new patterns
      await db.insert(contentPatterns).values(
        patterns.map((p) => ({
          sourceCorpusId: input.corpusEntryId,
          sourceVideoId: entry.sourceType === "transcript" ? entry.sourceId : null,
          patternType: p.type,
          patternText: p.text,
          patternContext: p.context,
          effectivenessScore,
          usageCount: 0,
          tags: (entry.tags as string[] | null) ?? [],
        }))
      );

      return { extracted: patterns.length, skipped: false };
    }),

  // ─── Batch extract from all corpus entries ────────────────────────────────
  extractAll: protectedProcedure
    .input(z.object({
      overwrite: z.boolean().default(false),
      limit: z.number().min(1).max(50).default(20),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get corpus entries that don't have patterns yet (unless overwrite)
      let entries;
      if (input.overwrite) {
        entries = await db
          .select({ id: corpusEntries.id, title: corpusEntries.title, sourceType: corpusEntries.sourceType })
          .from(corpusEntries)
          .where(eq(corpusEntries.inCorpus, 1))
          .orderBy(desc(corpusEntries.createdAt))
          .limit(input.limit);
      } else {
        // Find entries without patterns
        const withPatterns = await db
          .select({ id: contentPatterns.sourceCorpusId })
          .from(contentPatterns)
          .groupBy(contentPatterns.sourceCorpusId);
        const withPatternIds = withPatterns.map((r) => r.id).filter(Boolean) as number[];

        const conditions = [eq(corpusEntries.inCorpus, 1)];

        entries = await db
          .select({ id: corpusEntries.id, title: corpusEntries.title, sourceType: corpusEntries.sourceType })
          .from(corpusEntries)
          .where(and(...conditions))
          .orderBy(desc(corpusEntries.createdAt))
          .limit(input.limit * 3); // fetch more, filter client-side

        if (withPatternIds.length > 0) {
          entries = entries.filter((e) => !withPatternIds.includes(e.id)).slice(0, input.limit);
        } else {
          entries = entries.slice(0, input.limit);
        }
      }

      let totalExtracted = 0;
      let processed = 0;
      const errors: string[] = [];

      for (const entry of entries) {
        try {
          const [full] = await db.select().from(corpusEntries).where(eq(corpusEntries.id, entry.id)).limit(1);
          if (!full) continue;

          let effectivenessScore = 0.8;
          if (full.sourceType === "transcript" && full.sourceId) {
            const outlierRows = await db.execute(
              sql`SELECT outlier_score FROM yt_video_outliers WHERE video_id = ${full.sourceId} LIMIT 1`
            ) as unknown as { rows: { outlier_score: number }[] };
            const rows = (outlierRows as any).rows ?? (outlierRows as any) ?? [];
            if (rows[0]?.outlier_score) {
              effectivenessScore = Math.min(1.0, Number(rows[0].outlier_score) / 3.0);
            }
          }

          if (input.overwrite) {
            await db.delete(contentPatterns).where(eq(contentPatterns.sourceCorpusId, entry.id));
          }

          const patterns = await extractPatternsFromContent(full.content, full.title);
          if (patterns.length > 0) {
            await db.insert(contentPatterns).values(
              patterns.map((p) => ({
                sourceCorpusId: entry.id,
                sourceVideoId: full.sourceType === "transcript" ? full.sourceId : null,
                patternType: p.type,
                patternText: p.text,
                patternContext: p.context,
                effectivenessScore,
                usageCount: 0,
                tags: (full.tags as string[] | null) ?? [],
              }))
            );
            totalExtracted += patterns.length;
          }
          processed++;
        } catch (err) {
          errors.push(`Entry ${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return { processed, totalExtracted, errors };
    }),

  // ─── List patterns ────────────────────────────────────────────────────────
  listPatterns: protectedProcedure
    .input(z.object({
      patternType: z.enum([...PATTERN_TYPES, "all"] as [string, ...string[]]).default("all"),
      minEffectiveness: z.number().min(0).max(1).default(0),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      sortBy: z.enum(["effectiveness", "usage", "created"]).default("effectiveness"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.patternType !== "all") {
        conditions.push(eq(contentPatterns.patternType, input.patternType as PatternType));
      }
      if (input.minEffectiveness > 0) {
        conditions.push(gte(contentPatterns.effectivenessScore, input.minEffectiveness));
      }

      const orderBy =
        input.sortBy === "usage" ? desc(contentPatterns.usageCount) :
        input.sortBy === "created" ? desc(contentPatterns.createdAt) :
        desc(contentPatterns.effectivenessScore);

      return db
        .select()
        .from(contentPatterns)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get pattern stats ────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byType: {} };

    const [totals] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(contentPatterns);

    const byType = await db
      .select({
        type: contentPatterns.patternType,
        count: sql<number>`COUNT(*)`,
        avgEffectiveness: sql<number>`AVG(effectiveness_score)`,
        totalUsage: sql<number>`SUM(usage_count)`,
      })
      .from(contentPatterns)
      .groupBy(contentPatterns.patternType)
      .orderBy(desc(sql`COUNT(*)`));

    return {
      total: Number(totals?.total ?? 0),
      byType: Object.fromEntries(
        byType.map((r) => [
          r.type,
          {
            count: Number(r.count),
            avgEffectiveness: Number(r.avgEffectiveness ?? 0),
            totalUsage: Number(r.totalUsage ?? 0),
          },
        ])
      ),
    };
  }),

  // ─── Get patterns for Script Factory (by type, top-N by effectiveness) ───
  getForScriptFactory: protectedProcedure
    .input(z.object({
      types: z.array(z.enum(PATTERN_TYPES)).min(1),
      topN: z.number().min(1).max(10).default(3),
      minEffectiveness: z.number().min(0).max(1).default(0.5),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};

      const result: Record<string, typeof contentPatterns.$inferSelect[]> = {};

      for (const type of input.types) {
        const rows = await db
          .select()
          .from(contentPatterns)
          .where(
            and(
              eq(contentPatterns.patternType, type),
              gte(contentPatterns.effectivenessScore, input.minEffectiveness)
            )
          )
          .orderBy(desc(contentPatterns.effectivenessScore))
          .limit(input.topN);
        result[type] = rows;
      }

      return result;
    }),

  // ─── Delete a pattern ─────────────────────────────────────────────────────
  deletePattern: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(contentPatterns).where(eq(contentPatterns.id, input.id));
      return { ok: true };
    }),

  // ─── Increment usage count (called by Script Factory) ────────────────────
  incrementUsage: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db
        .update(contentPatterns)
        .set({
          usageCount: sql`usage_count + 1`,
          lastUsedAt: sql`NOW()`,
        })
        .where(inArray(contentPatterns.id, input.ids));
      return { ok: true };
    }),
});

// Export PATTERN_TYPES for tests
export { PATTERN_TYPES };
