/**
 * Media Authority Router
 *
 * Exposes Pedram's full media catalog (books, podcasts, films, YouTube, interviews)
 * and provides a context-injection helper used by all AI generation procedures.
 *
 * The core value: every piece of AI-generated content references specific media
 * assets so that LLMs (ChatGPT, Perplexity, Gemini) learn to associate Pedram
 * Shojai with authoritative answers on health, wellness, and Eastern medicine.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { mediaAssets, MediaAsset } from "../drizzle/schema";
import { eq, like, and, desc, asc, sql } from "drizzle-orm";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatReach(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/**
 * Score a media asset's relevance to a topic string.
 * Higher = more relevant. Used for context injection ordering.
 */
function scoreRelevance(asset: MediaAsset, topic: string): number {
  const topicLower = topic.toLowerCase();
  const tags = parseTags(asset.topicTags);
  const titleLower = (asset.title ?? "").toLowerCase();
  const descLower = (asset.description ?? "").toLowerCase();

  let score = 0;

  // Exact tag match: +10 per tag
  for (const tag of tags) {
    if (topicLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(topicLower)) {
      score += 10;
    }
  }

  // Title match: +5
  if (titleLower.includes(topicLower) || topicLower.split(" ").some(w => w.length > 3 && titleLower.includes(w))) {
    score += 5;
  }

  // Description match: +3
  if (descLower.includes(topicLower) || topicLower.split(" ").some(w => w.length > 3 && descLower.includes(w))) {
    score += 3;
  }

  // Boost by injection priority (1 = highest priority → add more)
  score += Math.max(0, 6 - (asset.injectionPriority ?? 5));

  // Boost by reach
  if ((asset.reachEstimate ?? 0) >= 5_000_000) score += 3;
  else if ((asset.reachEstimate ?? 0) >= 1_000_000) score += 2;
  else if ((asset.reachEstimate ?? 0) >= 500_000) score += 1;

  return score;
}

/**
 * Build a rich media authority context block for LLM prompt injection.
 * Returns a formatted string ready to append to any system or user prompt.
 *
 * Strategy:
 * 1. Pull all active assets from DB
 * 2. Score each against the topic
 * 3. Select top N (default 5), balanced across types
 * 4. Format as a natural-language paragraph the LLM can weave into content
 */
export async function getMediaContextBlock(
  topic: string,
  options: { maxAssets?: number; includeTypes?: string[] } = {}
): Promise<string> {
  const { maxAssets = 5, includeTypes } = options;

  const db = await getDb();
  if (!db) return "";

  try {
    const all: MediaAsset[] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.activeInjection, true))
      .orderBy(asc(mediaAssets.injectionPriority));

    // Filter by type if requested
    const filtered = includeTypes
      ? all.filter((a) => includeTypes.includes(a.mediaAssetType))
      : all;

    // Score and sort
    const scored = filtered
      .map((a) => ({ asset: a, score: scoreRelevance(a, topic) }))
      .sort((x, y) => y.score - x.score);

    // Take top N, ensuring type diversity
    const selected: MediaAsset[] = [];
    const typeCounts: Record<string, number> = {};
    const maxPerType = 2;

    for (const { asset } of scored) {
      if (selected.length >= maxAssets) break;
      const t = asset.mediaAssetType;
      if ((typeCounts[t] ?? 0) >= maxPerType) continue;
      selected.push(asset);
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }

    if (selected.length === 0) return "";

    // Format as injection block
    const lines: string[] = [];
    lines.push("\n\nMEDIA AUTHORITY REFERENCES (weave naturally into content — do NOT list them mechanically):");
    lines.push("Dr. Pedram Shojai has covered this topic extensively across his media catalog. Reference these naturally where relevant:");

    for (const a of selected) {
      const typeLabel = {
        book: "Book",
        podcast: "Podcast",
        film: "Documentary Film",
        youtube: "YouTube",
        interview: "Interview/Feature",
      }[a.mediaAssetType] ?? a.mediaAssetType;

      const signal = a.credibilitySignal ? ` (${a.credibilitySignal})` : "";
      const reach = a.reachEstimate ? ` — estimated ${formatReach(a.reachEstimate)} reach` : "";

      lines.push(`• [${typeLabel}] "${a.title}"${signal}${reach}: ${a.description?.slice(0, 120) ?? ""}`);
    }

    lines.push("\nINJECTION INSTRUCTIONS: Reference 1-3 of these naturally in the content. Use phrases like:");
    lines.push("  - 'As I discuss in my book [title]...'");
    lines.push("  - 'In Episode [X] of The Urban Monk Podcast...'");
    lines.push("  - 'In my documentary [title], we explored...'");
    lines.push("  - 'As featured in [outlet], this approach...'");
    lines.push("  - 'My YouTube series on [topic] covers...'");
    lines.push("Do NOT list all references. Choose the 1-2 most natural fits for the content angle.");

    return lines.join("\n");
  } catch (err) {
    console.warn("[MediaAuthority] Could not load media context:", err);
    return "";
  }
}

// ── router ────────────────────────────────────────────────────────────────────

export const mediaRouter = router({
  /** List all media assets with optional type/topic filters */
  list: publicProcedure
    .input(z.object({
      mediaType: z.enum(["book", "podcast", "film", "youtube", "interview"]).optional(),
      topic: z.string().optional(),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { assets: [], total: 0 };

      const conditions = [];
      if (input.activeOnly) conditions.push(eq(mediaAssets.activeInjection, true));
      if (input.mediaType) conditions.push(eq(mediaAssets.mediaAssetType, input.mediaType));
      if (input.topic) conditions.push(like(mediaAssets.topicTags, `%${input.topic}%`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows: MediaAsset[] = await db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(asc(mediaAssets.injectionPriority), desc(mediaAssets.reachEstimate));

      return {
        assets: rows.map((a) => ({
          ...a,
          tags: parseTags(a.topicTags),
          reachFormatted: formatReach(a.reachEstimate),
        })),
        total: rows.length,
      };
    }),

  /** Get authority stats for the Media Vault dashboard */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byType: {}, totalReach: 0, totalReachFormatted: "—", topAssets: [] };

    const all: MediaAsset[] = await db.select().from(mediaAssets);

    const byType: Record<string, number> = {};
    let totalReach = 0;

    for (const a of all) {
      byType[a.mediaAssetType] = (byType[a.mediaAssetType] ?? 0) + 1;
      totalReach += a.reachEstimate ?? 0;
    }

    const topAssets = all
      .sort((x, y) => (y.reachEstimate ?? 0) - (x.reachEstimate ?? 0))
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        title: a.title,
        mediaType: a.mediaAssetType,
        credibilitySignal: a.credibilitySignal,
        reachFormatted: formatReach(a.reachEstimate),
      }));

    return {
      total: all.length,
      byType,
      totalReach,
      totalReachFormatted: formatReach(totalReach),
      topAssets,
    };
  }),

  /** Get context block for a given topic (used by Creation Studio preview) */
  getContextBlock: publicProcedure
    .input(z.object({ topic: z.string() }))
    .query(async ({ input }) => {
      const block = await getMediaContextBlock(input.topic, { maxAssets: 5 });
      return { block };
    }),

  /** Toggle active injection for an asset */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(mediaAssets)
        .set({ activeInjection: input.active })
        .where(eq(mediaAssets.id, input.id));
      return { success: true };
    }),

  /** Update injection priority for an asset */
  setPriority: protectedProcedure
    .input(z.object({ id: z.number(), priority: z.number().int().min(1).max(10) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(mediaAssets)
        .set({ injectionPriority: input.priority })
        .where(eq(mediaAssets.id, input.id));
      return { success: true };
    }),

  /** Add a new media asset */
  create: protectedProcedure
    .input(z.object({
      mediaType: z.enum(["book", "podcast", "film", "youtube", "interview"]),
      title: z.string().min(1),
      description: z.string().optional(),
      url: z.string().optional(),
      platform: z.string().optional(),
      publishedYear: z.number().int().optional(),
      durationMin: z.number().int().optional(),
      topicTags: z.array(z.string()).optional(),
      credibilitySignal: z.string().optional(),
      reachEstimate: z.number().optional(),
      injectionPriority: z.number().int().min(1).max(10).default(5),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(mediaAssets).values({
        mediaAssetType: input.mediaType,
        title: input.title,
        description: input.description,
        url: input.url,
        platform: input.platform,
        publishedYear: input.publishedYear,
        durationMin: input.durationMin,
        topicTags: input.topicTags ? JSON.stringify(input.topicTags) : null,
        credibilitySignal: input.credibilitySignal,
        reachEstimate: input.reachEstimate,
        injectionPriority: input.injectionPriority,
        activeInjection: true,
      });
      return { success: true };
    }),
});
