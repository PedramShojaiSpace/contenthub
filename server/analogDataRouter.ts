/**
 * Analog Data Library Router
 *
 * Keith's "Analyze" section — corpus seed for the Transcript Intelligence Engine.
 *
 * CRITICAL QUALITY GATE: Only CONVERTING content goes in here.
 * Winning ads, converting sales pages, real customer interview transcripts, survey data.
 * NOT aspirational or untested content.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { analogDataEntries } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson, wrapLLM } from "./llmUtils";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const ANALOG_DATA_TYPES = [
  "sales_page",
  "facebook_ad",
  "customer_interview",
  "text_survey",
  "vsl_script",
  "email_sequence",
  "other",
] as const;

export const analogDataRouter = router({
  // ─── List entries with optional filters ──────────────────────────────────────
  listEntries: protectedProcedure
    .input(
      z.object({
        type: z.enum(ANALOG_DATA_TYPES).optional(),
        personaId: z.number().optional(),
        tag: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];

      if (input.type) {
        conditions.push(eq(analogDataEntries.type, input.type));
      }
      if (input.personaId) {
        conditions.push(eq(analogDataEntries.personaId, input.personaId));
      }
      if (input.search) {
        conditions.push(
          or(
            like(analogDataEntries.title, `%${input.search}%`),
            like(analogDataEntries.content, `%${input.search}%`)
          )
        );
      }
      if (input.tag) {
        // Tags stored as JSON array — use LIKE for simple substring match
        conditions.push(like(analogDataEntries.tags, `%${input.tag}%`));
      }

      const rows = await db
        .select({
          id: analogDataEntries.id,
          title: analogDataEntries.title,
          type: analogDataEntries.type,
          tags: analogDataEntries.tags,
          personaId: analogDataEntries.personaId,
          extractedInsights: analogDataEntries.extractedInsights,
          inCorpus: analogDataEntries.inCorpus,
          // Return first 300 chars of content as preview
          contentPreview: sql<string>`LEFT(${analogDataEntries.content}, 300)`,
          createdAt: analogDataEntries.createdAt,
          updatedAt: analogDataEntries.updatedAt,
        })
        .from(analogDataEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(analogDataEntries.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((r) => ({
        ...r,
        tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
        extractedInsights: r.extractedInsights
          ? JSON.parse(r.extractedInsights)
          : null,
      }));
    }),

  // ─── Get single entry (full content) ─────────────────────────────────────────
  getEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db
        .select()
        .from(analogDataEntries)
        .where(eq(analogDataEntries.id, input.id))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      return {
        ...row,
        tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
        extractedInsights: row.extractedInsights
          ? JSON.parse(row.extractedInsights)
          : null,
      };
    }),

  // ─── Auto-generate title from content ────────────────────────────────────────
  generateTitle: protectedProcedure
    .input(
      z.object({
        content: z.string().min(50).max(50000),
        type: z.enum(ANALOG_DATA_TYPES),
      })
    )
    .mutation(async ({ input }) => {
      const typeLabel: Record<string, string> = {
        sales_page: "sales page",
        facebook_ad: "Facebook ad",
        customer_interview: "customer interview transcript",
        text_survey: "text survey response",
        vsl_script: "VSL script",
        email_sequence: "email sequence",
        other: "marketing asset",
      };

      const result = await wrapLLM(() =>
        invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a marketing analyst. Generate a concise, descriptive title for the provided content. Return ONLY a JSON object with a single 'title' field. No other text.",
            },
            {
              role: "user",
              content: `Generate a title for this ${typeLabel[input.type]}:\n\n${input.content.slice(0, 2000)}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "title_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "A concise descriptive title (max 80 chars)",
                  },
                },
                required: ["title"],
                additionalProperties: false,
              },
            },
          },
        })
      );

      const content = String(result.choices?.[0]?.message?.content ?? "{}");
      const parsed = parseLLMJson<{ title: string }>(content);
      return { title: parsed.title };
    }),

  // ─── Add new entry ────────────────────────────────────────────────────────────
  addEntry: protectedProcedure
    .input(
      z.object({
        title: z.string().max(255).optional(),
        autoGenerateTitle: z.boolean().default(false),
        type: z.enum(ANALOG_DATA_TYPES),
        tags: z.array(z.string()).default([]),
        personaId: z.number().optional(),
        content: z.string().min(50, "Content must be at least 50 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // ─── SAVE-FIRST STRATEGY ──────────────────────────────────────────────────
      // We insert the entry into the DB immediately with a fallback title so the
      // save NEVER fails due to an LLM timeout. LLM enrichment (title + insights)
      // runs after the insert and updates the row in-place. This means:
      //   • The entry always appears in the Library after clicking "Save to Library"
      //   • inCorpus defaults to TRUE so it is immediately available for seeding
      //   • If LLM enrichment fails, the raw content is still saved and usable

      // Step 1: Insert with fallback title (no LLM dependency on the critical path)
      const fallbackTitle = input.title?.trim() ||
        `${input.type.replace(/_/g, " ")} — ${new Date().toLocaleDateString()}`;

      const insertResult = await db.insert(analogDataEntries).values({
        title: fallbackTitle,
        type: input.type,
        tags: JSON.stringify(input.tags),
        personaId: input.personaId ?? null,
        content: input.content,
        extractedInsights: null,
        // Default inCorpus=TRUE so entries are immediately available for seeding
        // without requiring a manual "toggle to corpus" step
        inCorpus: true,
      });
      const newId: number = (insertResult as any)?.insertId ?? (insertResult as any)?.[0]?.insertId ?? 0;

      // Step 2: LLM enrichment — runs after save, updates in-place
      // Errors here are non-fatal; the entry is already saved.
      let finalTitle = fallbackTitle;
      let extractedInsights: Record<string, unknown> | null = null;

      try {
        // 2a. Auto-generate title if requested
        if (!input.title?.trim() || input.autoGenerateTitle) {
          const typeLabel: Record<string, string> = {
            sales_page: "sales page",
            facebook_ad: "Facebook ad",
            customer_interview: "customer interview transcript",
            text_survey: "text survey response",
            vsl_script: "VSL script",
            email_sequence: "email sequence",
            other: "marketing asset",
          };
          const titleResult = await wrapLLM(() =>
            invokeLLM({
              messages: [
                { role: "system", content: "You are a marketing analyst. Generate a concise, descriptive title. Return ONLY a JSON object with a single 'title' field." },
                { role: "user", content: `Generate a title for this ${typeLabel[input.type]}:\n\n${input.content.slice(0, 2000)}` },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "title_result",
                  strict: true,
                  schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"], additionalProperties: false },
                },
              },
            })
          );
          const titleContent = String(titleResult.choices?.[0]?.message?.content ?? "{}");
          const parsed = parseLLMJson<{ title: string }>(titleContent);
          if (parsed.title) finalTitle = parsed.title;
        }
      } catch {
        // Keep fallback title — entry is already saved
      }

      try {
        // 2b. Extract conversion insights
        const insightResult = await wrapLLM(() =>
          invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a direct-response marketing analyst studying converting content.
Extract the key patterns from this ${input.type.replace(/_/g, " ")}.
Return ONLY a JSON object with these fields:
- hooks: string[] (opening hooks or attention-grabbers)
- painPoints: string[] (pain points addressed)
- proofElements: string[] (social proof, testimonials, stats)
- objectionHandlers: string[] (objections addressed)
- ctas: string[] (calls to action used)
- keyPhrases: string[] (exact phrases likely to resonate with the audience)
- conversionMechanisms: string[] (what makes this piece convert)

Focus on EXACT language from the content, not paraphrases.`,
              },
              { role: "user", content: input.content.slice(0, 8000) },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "insights",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    hooks: { type: "array", items: { type: "string" } },
                    painPoints: { type: "array", items: { type: "string" } },
                    proofElements: { type: "array", items: { type: "string" } },
                    objectionHandlers: { type: "array", items: { type: "string" } },
                    ctas: { type: "array", items: { type: "string" } },
                    keyPhrases: { type: "array", items: { type: "string" } },
                    conversionMechanisms: { type: "array", items: { type: "string" } },
                  },
                  required: ["hooks", "painPoints", "proofElements", "objectionHandlers", "ctas", "keyPhrases", "conversionMechanisms"],
                  additionalProperties: false,
                },
              },
            },
          })
        );
        const insightContent = String(insightResult.choices?.[0]?.message?.content ?? "{}");
        extractedInsights = parseLLMJson(insightContent);
      } catch {
        // Keep null insights — entry is already saved
      }

      // Step 3: Update the row with enriched title + insights (best-effort)
      if (newId) {
        try {
          await db
            .update(analogDataEntries)
            .set({
              title: finalTitle,
              extractedInsights: extractedInsights ? JSON.stringify(extractedInsights) : null,
            })
            .where(eq(analogDataEntries.id, newId));
        } catch {
          // Non-fatal — entry is already saved with fallback title
        }
      }

      return {
        id: newId,
        title: finalTitle,
        extractedInsights,
      };
    }),

  // ─── Delete entry ─────────────────────────────────────────────────────────────
  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .delete(analogDataEntries)
        .where(eq(analogDataEntries.id, input.id));
      return { success: true };
    }),

  // ─── Update entry (tags, persona, title) ─────────────────────────────────────
  updateEntry: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().max(255).optional(),
        tags: z.array(z.string()).optional(),
        personaId: z.number().nullable().optional(),
        inCorpus: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
      if (input.personaId !== undefined) updates.personaId = input.personaId;
      if (input.inCorpus !== undefined) updates.inCorpus = input.inCorpus;

      await db
        .update(analogDataEntries)
        .set(updates)
        .where(eq(analogDataEntries.id, input.id));

      return { success: true };
    }),

  // ─── Get library stats ────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, inCorpus: 0, byType: [] };
    const [countRow] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(analogDataEntries);

    const [corpusRow] = await db
      .select({ inCorpus: sql<number>`COUNT(*)` })
      .from(analogDataEntries)
      .where(eq(analogDataEntries.inCorpus, true));

    const typeRows = await db
      .select({
        type: analogDataEntries.type,
        count: sql<number>`COUNT(*)`,
      })
      .from(analogDataEntries)
      .groupBy(analogDataEntries.type);

    return {
      total: Number(countRow?.total ?? 0),
      inCorpus: Number(corpusRow?.inCorpus ?? 0),
      byType: typeRows.map((r) => ({
        type: r.type,
        count: Number(r.count),
      })),
    };
  }),
});
