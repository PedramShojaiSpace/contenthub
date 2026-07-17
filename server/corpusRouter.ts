/**
 * Corpus Builder Router — Phase C
 *
 * Manages the verified content corpus used to ground the Script Factory.
 *
 * Search strategy:
 *   1. Vector similarity via TiDB VEC_COSINE_DISTANCE (primary)
 *   2. Keyword LIKE fallback if vector search returns no results or embedding unavailable
 *
 * Embedding model: text-embedding-3-small (1536 dims) via Manus built-in LLM proxy.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { analogDataEntries, corpusEntries, ytTranscripts } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { ENV } from "./_core/env";

// ─── Embedding helper ─────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const CHUNK_MAX_CHARS = 2000; // first N chars used for embedding

/**
 * Generate an embedding vector for the given text using the Manus LLM proxy.
 * Returns a float array of length EMBEDDING_DIMS, or null on failure.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiUrl = ENV.forgeApiUrl;
    const apiKey = ENV.forgeApiKey;
    if (!apiUrl || !apiKey) return null;

    const chunk = text.slice(0, CHUNK_MAX_CHARS).replace(/\s+/g, " ").trim();
    if (chunk.length < 10) return null;

    const res = await fetch(`${apiUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunk }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { data?: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * Serialize embedding array to TiDB VECTOR literal string: '[1.0,0.5,...]'
 */
function serializeEmbedding(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const corpusRouter = router({

  // ─── Add a single entry to the corpus ────────────────────────────────────
  addToCorpus: protectedProcedure
    .input(
      z.object({
        sourceType: z.enum(["transcript", "analog_data", "manual"]),
        sourceId: z.string().optional(),
        title: z.string().optional(),
        content: z.string().min(10),
        tags: z.array(z.string()).optional(),
        personaId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const wordCount = input.content.trim().split(/\s+/).length;
      const contentChunk = input.content.slice(0, CHUNK_MAX_CHARS);

      // Generate embedding
      const embeddingVec = await generateEmbedding(input.content);
      const embeddingStr = embeddingVec ? serializeEmbedding(embeddingVec) : null;

      const [result] = await db.insert(corpusEntries).values({
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        title: input.title ?? null,
        content: input.content,
        contentChunk,
        embedding: embeddingStr,
        tags: input.tags ?? [],
        personaId: input.personaId ?? null,
        wordCount,
        inCorpus: 1,
      });

      return { id: (result as any).insertId, embedded: embeddingVec !== null };
    }),

  // ─── Seed corpus from analog_data_entries ────────────────────────────────
  seedFromAnalogData: protectedProcedure
    .input(z.object({ overwrite: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Only seed entries the user has explicitly toggled into the corpus (inCorpus = true)
      const analogRows = await db
        .select({ id: analogDataEntries.id, title: analogDataEntries.title, content: analogDataEntries.content, tags: analogDataEntries.tags, personaId: analogDataEntries.personaId })
        .from(analogDataEntries)
        .where(eq(analogDataEntries.inCorpus, true));

      let added = 0, skipped = 0, embedded = 0;

      for (const row of analogRows) {
        const sourceId = String(row.id);

        if (!input.overwrite) {
          const [existing] = await db
            .select({ id: corpusEntries.id })
            .from(corpusEntries)
            .where(and(eq(corpusEntries.sourceType, "analog_data"), eq(corpusEntries.sourceId, sourceId)))
            .limit(1);
          if (existing) { skipped++; continue; }
        }

        const wordCount = row.content.trim().split(/\s+/).length;
        const contentChunk = row.content.slice(0, CHUNK_MAX_CHARS);
        const embeddingVec = await generateEmbedding(row.content);
        const embeddingStr = embeddingVec ? serializeEmbedding(embeddingVec) : null;
        if (embeddingVec) embedded++;

        if (input.overwrite) {
          await db.delete(corpusEntries).where(
            and(eq(corpusEntries.sourceType, "analog_data"), eq(corpusEntries.sourceId, sourceId))
          );
        }

        // Parse tags — stored as JSON string in analog_data_entries
        let parsedTags: string[] = [];
        try {
          if (row.tags) {
            const t = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
            parsedTags = Array.isArray(t) ? t : [];
          }
        } catch { parsedTags = []; }

        await db.insert(corpusEntries).values({
          sourceType: "analog_data",
          sourceId,
          title: row.title ?? null,
          content: row.content,
          contentChunk,
          embedding: embeddingStr,
          tags: parsedTags,
          personaId: row.personaId ?? null,
          wordCount,
          inCorpus: 1,
        });
        added++;
      }

      return { added, skipped, embedded, total: analogRows.length };
    }),

  // ─── Seed corpus from outlier transcripts ────────────────────────────────
  seedFromOutlierTranscripts: protectedProcedure
    .input(z.object({ overwrite: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Only pull transcripts that are flagged as outliers
      const outlierTranscripts = await db.execute(
        sql`SELECT t.video_id, t.video_title, t.raw_text, t.word_count
            FROM yt_transcripts t
            INNER JOIN yt_video_outliers o ON t.video_id = o.video_id
            WHERE t.status = 'fetched'
              AND o.is_outlier = 1
              AND t.raw_text IS NOT NULL`
      ) as unknown as { rows: { video_id: string; video_title: string; raw_text: string; word_count: number }[] };

      const rows = (outlierTranscripts as any).rows ?? (outlierTranscripts as any) ?? [];

      let added = 0, skipped = 0, embedded = 0;

      for (const row of rows) {
        if (!row.raw_text) continue;

        if (!input.overwrite) {
          const [existing] = await db
            .select({ id: corpusEntries.id })
            .from(corpusEntries)
            .where(and(eq(corpusEntries.sourceType, "transcript"), eq(corpusEntries.sourceId, row.video_id)))
            .limit(1);
          if (existing) { skipped++; continue; }
        }

        const contentChunk = row.raw_text.slice(0, CHUNK_MAX_CHARS);
        const embeddingVec = await generateEmbedding(row.raw_text);
        const embeddingStr = embeddingVec ? serializeEmbedding(embeddingVec) : null;
        if (embeddingVec) embedded++;

        if (input.overwrite) {
          await db.delete(corpusEntries).where(
            and(eq(corpusEntries.sourceType, "transcript"), eq(corpusEntries.sourceId, row.video_id))
          );
        }

        await db.insert(corpusEntries).values({
          sourceType: "transcript",
          sourceId: row.video_id,
          title: row.video_title ?? null,
          content: row.raw_text,
          contentChunk,
          embedding: embeddingStr,
          tags: [],
          wordCount: row.word_count ?? 0,
          inCorpus: 1,
        });
        added++;
      }

      return { added, skipped, embedded, total: rows.length };
    }),

  // ─── Search corpus ────────────────────────────────────────────────────────
  searchCorpus: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        topK: z.number().min(1).max(20).default(5),
        sourceType: z.enum(["transcript", "analog_data", "manual", "all"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], method: "none" as const };

      // Try vector search first
      const queryEmbedding = await generateEmbedding(input.query);

      if (queryEmbedding) {
        try {
          const vecStr = serializeEmbedding(queryEmbedding);
          const conditions = input.sourceType !== "all"
            ? `AND source_type = '${input.sourceType}'`
            : "";

          const vectorResults = await db.execute(
            sql.raw(`
              SELECT id, source_type, source_id, title,
                     LEFT(content, 500) AS excerpt,
                     word_count, tags, persona_id, created_at,
                     VEC_COSINE_DISTANCE(embedding, '${vecStr}') AS distance
              FROM corpus_entries
              WHERE in_corpus = 1
                AND embedding IS NOT NULL
                ${conditions}
              ORDER BY distance ASC
              LIMIT ${input.topK}
            `)
          ) as unknown as { rows: any[] };

          const rows = (vectorResults as any).rows ?? (vectorResults as any) ?? [];

          if (rows.length > 0) {
            return {
              results: rows.map((r: any) => ({
                id: r.id,
                sourceType: r.source_type,
                sourceId: r.source_id,
                title: r.title,
                excerpt: r.excerpt,
                wordCount: r.word_count,
                tags: r.tags,
                personaId: r.persona_id,
                createdAt: r.created_at,
                distance: Number(r.distance),
                similarity: 1 - Number(r.distance),
              })),
              method: "vector" as const,
            };
          }
        } catch {
          // Fall through to keyword search
        }
      }

      // Keyword fallback
      const keywords = input.query.trim().split(/\s+/).slice(0, 5);
      const likeConditions = keywords.map((kw) =>
        or(
          like(corpusEntries.content, `%${kw}%`),
          like(corpusEntries.title, `%${kw}%`)
        )
      );

      const sourceFilter = input.sourceType !== "all"
        ? [eq(corpusEntries.sourceType, input.sourceType as "transcript" | "analog_data" | "manual")]
        : [];

      const keywordRows = await db
        .select({
          id: corpusEntries.id,
          sourceType: corpusEntries.sourceType,
          sourceId: corpusEntries.sourceId,
          title: corpusEntries.title,
          content: corpusEntries.content,
          wordCount: corpusEntries.wordCount,
          tags: corpusEntries.tags,
          personaId: corpusEntries.personaId,
          createdAt: corpusEntries.createdAt,
        })
        .from(corpusEntries)
        .where(
          and(
            eq(corpusEntries.inCorpus, 1),
            ...sourceFilter,
            ...(likeConditions.length > 0 ? [or(...likeConditions.filter(Boolean))] : [])
          )
        )
        .orderBy(desc(corpusEntries.createdAt))
        .limit(input.topK);

      return {
        results: keywordRows.map((r) => ({
          id: r.id,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          title: r.title,
          excerpt: r.content.slice(0, 500),
          wordCount: r.wordCount,
          tags: r.tags,
          personaId: r.personaId,
          createdAt: r.createdAt,
          distance: null,
          similarity: null,
        })),
        method: "keyword" as const,
      };
    }),

  // ─── List corpus entries ──────────────────────────────────────────────────
  listEntries: protectedProcedure
    .input(
      z.object({
        sourceType: z.enum(["transcript", "analog_data", "manual", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(corpusEntries.inCorpus, 1)];
      if (input.sourceType !== "all") {
        conditions.push(eq(corpusEntries.sourceType, input.sourceType as "transcript" | "analog_data" | "manual"));
      }

      return db
        .select({
          id: corpusEntries.id,
          sourceType: corpusEntries.sourceType,
          sourceId: corpusEntries.sourceId,
          title: corpusEntries.title,
          wordCount: corpusEntries.wordCount,
          tags: corpusEntries.tags,
          personaId: corpusEntries.personaId,
          hasEmbedding: sql<number>`IF(embedding IS NOT NULL, 1, 0)`,
          createdAt: corpusEntries.createdAt,
        })
        .from(corpusEntries)
        .where(and(...conditions))
        .orderBy(desc(corpusEntries.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get corpus stats ─────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, embedded: 0, transcripts: 0, analogData: 0, manual: 0 };

    const [row] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        embedded: sql<number>`SUM(IF(embedding IS NOT NULL, 1, 0))`,
        transcripts: sql<number>`SUM(IF(source_type = 'transcript', 1, 0))`,
        analogData: sql<number>`SUM(IF(source_type = 'analog_data', 1, 0))`,
        manual: sql<number>`SUM(IF(source_type = 'manual', 1, 0))`,
      })
      .from(corpusEntries)
      .where(eq(corpusEntries.inCorpus, 1));

    return {
      total: Number(row?.total ?? 0),
      embedded: Number(row?.embedded ?? 0),
      transcripts: Number(row?.transcripts ?? 0),
      analogData: Number(row?.analogData ?? 0),
      manual: Number(row?.manual ?? 0),
    };
  }),

  // ─── Remove entry from corpus ─────────────────────────────────────────────
  removeEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(corpusEntries).set({ inCorpus: 0 }).where(eq(corpusEntries.id, input.id));
      return { ok: true };
    }),

  // ─── Re-embed a single entry ──────────────────────────────────────────────
  reEmbed: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [entry] = await db.select().from(corpusEntries).where(eq(corpusEntries.id, input.id)).limit(1);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });

      const embeddingVec = await generateEmbedding(entry.content);
      if (!embeddingVec) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Embedding generation failed" });

      await db.update(corpusEntries).set({ embedding: serializeEmbedding(embeddingVec), contentChunk: entry.content.slice(0, CHUNK_MAX_CHARS) }).where(eq(corpusEntries.id, input.id));
      return { ok: true, dims: embeddingVec.length };
    }),
});
