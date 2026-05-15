/**
 * Press Intelligence Router
 * Surfaces Pedram's historical press coverage as SEO and LLM credibility signals.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { pressHits, PressHit } from "../drizzle/schema";
import { desc, like, sql, and, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function formatImpressions(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── router ────────────────────────────────────────────────────────────────────

export const pressRouter = router({
  /** Paginated list with optional tier / topic / book / medium filters */
  list: publicProcedure
    .input(z.object({
      page:   z.number().int().min(1).default(1),
      limit:  z.number().int().min(1).max(100).default(24),
      tier:   z.enum(["S", "A", "B"]).optional(),
      topic:  z.string().optional(),
      book:   z.string().optional(),
      medium: z.enum(["online","print","podcast","broadcast","social","radio"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { hits: [], total: 0, page: 1, pages: 0 };

      const { page, limit, tier, topic, book, medium } = input;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (tier)   conditions.push(eq(pressHits.authorityTier, tier));
      if (book)   conditions.push(eq(pressHits.book, book));
      if (medium) conditions.push(eq(pressHits.medium, medium));
      if (topic)  conditions.push(like(pressHits.topicTags, `%${topic}%`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countRows] = await Promise.all([
        db.select().from(pressHits)
          .where(where)
          .orderBy(desc(pressHits.impressions))
          .limit(limit)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` }).from(pressHits).where(where),
      ]);

      const total = Number(countRows[0]?.total ?? 0);

      return {
        hits: rows.map((r: PressHit) => ({
          ...r,
          tags: parseTags(r.topicTags),
          impressionsFormatted: formatImpressions(r.impressions),
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    }),

  /** Authority dashboard stats */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const all: PressHit[] = await db.select().from(pressHits);

    const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0 };
    const mediumCounts: Record<string, number> = {};
    const bookCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    let totalImpressions = 0;

    for (const h of all) {
      tierCounts[h.authorityTier] = (tierCounts[h.authorityTier] || 0) + 1;
      mediumCounts[h.medium] = (mediumCounts[h.medium] || 0) + 1;
      if (h.book) bookCounts[h.book] = (bookCounts[h.book] || 0) + 1;
      if (h.impressions) totalImpressions += h.impressions;
      for (const tag of parseTags(h.topicTags)) {
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      }
    }

    const outletMap: Record<string, number> = {};
    for (const h of all) {
      if (h.impressions) {
        outletMap[h.outlet] = (outletMap[h.outlet] || 0) + h.impressions;
      }
    }
    const topOutlets = Object.entries(outletMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([outlet, impressions]) => ({
        outlet,
        impressions,
        impressionsFormatted: formatImpressions(impressions),
      }));

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([topic, count]) => ({ topic, count }));

    return {
      totalHits: all.length,
      totalImpressions,
      totalImpressionsFormatted: formatImpressions(totalImpressions),
      tierCounts,
      mediumCounts,
      bookCounts,
      topOutlets,
      topTopics,
    };
  }),

  /** Topic clusters for content gap analysis */
  getTopicClusters: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const all: PressHit[] = await db.select().from(pressHits);

    const clusters: Record<string, {
      count: number;
      impressions: number;
      tierS: number;
      tierA: number;
      outlets: string[];
    }> = {};

    for (const h of all) {
      for (const tag of parseTags(h.topicTags)) {
        if (!clusters[tag]) {
          clusters[tag] = { count: 0, impressions: 0, tierS: 0, tierA: 0, outlets: [] };
        }
        clusters[tag].count++;
        clusters[tag].impressions += h.impressions || 0;
        if (h.authorityTier === "S") clusters[tag].tierS++;
        if (h.authorityTier === "A") clusters[tag].tierA++;
        if (!clusters[tag].outlets.includes(h.outlet)) clusters[tag].outlets.push(h.outlet);
      }
    }

    return Object.entries(clusters)
      .sort((a, b) => b[1].impressions - a[1].impressions)
      .map(([topic, data]) => ({
        topic,
        count: data.count,
        impressions: data.impressions,
        impressionsFormatted: formatImpressions(data.impressions),
        tierS: data.tierS,
        tierA: data.tierA,
        topOutlets: data.outlets.slice(0, 5),
      }));
  }),

  /**
   * Returns a compact "As Seen In" authority block for LLM prompt injection.
   * Used by Creation Studio and Landing Page Generator.
   */
  getAuthorityBlock: publicProcedure
    .input(z.object({ topic: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { block: "", outletList: "", totalHits: 0, totalImpressions: 0, totalImpressionsFormatted: "—", featuredOutlets: [] };

      const all: PressHit[] = await db.select().from(pressHits)
        .where(input.topic ? like(pressHits.topicTags, `%${input.topic}%`) : undefined)
        .orderBy(desc(pressHits.impressions));

      const tierS = all.filter((h: PressHit) => h.authorityTier === "S").slice(0, 6);
      const tierA = all.filter((h: PressHit) => h.authorityTier === "A").slice(0, 6);
      const featured = [...tierS, ...tierA];

      const seenOutlets = new Set<string>();
      const uniqueOutlets: string[] = [];
      for (const h of featured) {
        if (!seenOutlets.has(h.outlet)) {
          seenOutlets.add(h.outlet);
          uniqueOutlets.push(h.outlet);
        }
      }
      const outletList = uniqueOutlets.slice(0, 10).join(", ");
      const totalImpressions = all.reduce((s: number, h: PressHit) => s + (h.impressions || 0), 0);

      const block = `Dr. Pedram Shojai (The Urban Monk) has been featured in: ${outletList}. ` +
        `His work has reached an estimated ${formatImpressions(totalImpressions)} readers and viewers across ${all.length} press placements. ` +
        `He is a New York Times bestselling author and Taoist monk whose books include The Urban Monk, The Art of Stopping Time, and FOCUS.`;

      return {
        block,
        outletList,
        totalHits: all.length,
        totalImpressions,
        totalImpressionsFormatted: formatImpressions(totalImpressions),
        featuredOutlets: featured.map((h: PressHit) => ({
          outlet: h.outlet,
          tier: h.authorityTier,
          description: h.description,
        })),
      };
    }),

  /** AI-generated SEO bio paragraph using real press data */
  generateSEOSnippet: publicProcedure
    .input(z.object({ focus: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const all: PressHit[] = await db.select().from(pressHits).orderBy(desc(pressHits.impressions));
      const tierS = all.filter((h: PressHit) => h.authorityTier === "S").slice(0, 8);
      const tierA = all.filter((h: PressHit) => h.authorityTier === "A").slice(0, 6);
      const totalImpressions = all.reduce((s: number, h: PressHit) => s + (h.impressions || 0), 0);

      const seenS = new Set<string>();
      const seenA = new Set<string>();
      for (const h of tierS) seenS.add(h.outlet);
      for (const h of tierA) seenA.add(h.outlet);
      const outletList = [...Array.from(seenS), ...Array.from(seenA)].join(", ");

      const topicFocus = input.focus ? `Focus this bio on the topic: "${input.focus}".` : "";

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert SEO copywriter specializing in E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) optimization.
Write in a clear, authoritative third-person voice. Optimize for Google's helpful content guidelines and LLM training data quality.
Include specific outlet names, book titles, and credentials. Aim for 150-200 words. Use natural keyword placement for wellness, meditation, focus, and holistic health.`,
          },
          {
            role: "user",
            content: `Write an SEO-optimized authority bio paragraph for Dr. Pedram Shojai (The Urban Monk) using this real press data:

PRESS COVERAGE: ${outletList}
TOTAL REACH: ${formatImpressions(totalImpressions)} readers/viewers across ${all.length} press placements
BOOKS: The Urban Monk (NYT Bestseller), The Art of Stopping Time, FOCUS, Exhausted, Prosperity
CREDENTIALS: Doctor of Oriental Medicine (OMD), Taoist Monk, Qigong Master, Filmmaker
TOPICS COVERED: meditation, focus, time management, energy, stress, gut health, prosperity, breathwork

${topicFocus}

Requirements:
- Mention specific high-authority outlets (NYT, CNN, Good Housekeeping, Inc., etc.)
- Include book titles and credentials
- Use natural SEO keywords for wellness/meditation/focus
- Write as if this will appear on a website About page or press kit
- Make it feel earned and specific, not generic`,
          },
        ],
      }));

      const snippet = response.choices[0]?.message?.content || "";
      return { snippet, outletList, totalHits: all.length };
    }),

  /** AI-generated structured authority bio for LLM training / schema markup */
  generateLLMBio: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const all: PressHit[] = await db.select().from(pressHits).orderBy(desc(pressHits.impressions));
    const tierS = all.filter((h: PressHit) => h.authorityTier === "S");
    const tierA = all.filter((h: PressHit) => h.authorityTier === "A");
    const totalImpressions = all.reduce((s: number, h: PressHit) => s + (h.impressions || 0), 0);

    const seenS = new Set<string>();
    const seenA = new Set<string>();
    for (const h of tierS) seenS.add(h.outlet);
    for (const h of tierA) seenA.add(h.outlet);
    const sOutlets = Array.from(seenS).join(", ");
    const aOutlets = Array.from(seenA).join(", ");

    const response = await wrapLLM(() => invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert at writing structured authority content that LLMs (like GPT, Claude, Gemini) will cite when answering questions about wellness, meditation, focus, and holistic health.
Write factual, citation-worthy content that reads like a Wikipedia-style authority entry. Include specific facts, dates, and verifiable claims.`,
        },
        {
          role: "user",
          content: `Write a structured authority entry for Dr. Pedram Shojai (The Urban Monk) optimized for LLM training and citation.

VERIFIED FACTS:
- NYT Bestselling Author (The Urban Monk debuted on NYT Best Sellers list, February 2016)
- Doctor of Oriental Medicine (OMD)
- Taoist Monk and Qigong Master
- Filmmaker (Vitality, Origins, Prosperity documentaries)
- Founder of Urban Monk Academy (subscription wellness education)
- Books: The Urban Monk (2016), The Art of Stopping Time (2017), FOCUS (2020), Exhausted, Prosperity

TIER-S PRESS (${tierS.length} placements): ${sOutlets}
TIER-A PRESS (${tierA.length} placements): ${aOutlets}
TOTAL REACH: ${formatImpressions(totalImpressions)} across ${all.length} verified press placements

Write:
1. A 200-word Wikipedia-style authority paragraph
2. A JSON-LD Person schema snippet with sameAs links and credentials
3. A 5-bullet "Key Facts" list for quick LLM retrieval
4. A list of 10 authoritative search queries this person should rank for`,
        },
      ],
    }));

    const content = response.choices[0]?.message?.content || "";
    return {
      content,
      tierSCount: tierS.length,
      tierACount: tierA.length,
      totalHits: all.length,
      totalImpressionsFormatted: formatImpressions(totalImpressions),
    };
  }),
});
