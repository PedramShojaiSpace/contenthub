/**
 * DataForSEO tRPC Router
 *
 * Procedures:
 *   dfs.status               — credential check + account balance
 *   dfs.keywordOverview      — search volume, CPC, difficulty, intent for up to 20 keywords
 *   dfs.keywordsForSite      — top keywords a domain ranks for (sorted by volume)
 *   dfs.competitors          — top competitor domains for a given domain
 *   dfs.domainIntersection   — keywords both your domain and a competitor share
 *   dfs.rankedKeywords       — top keywords a competitor ranks for (gap analysis source)
 *   dfs.domainRankOverview   — organic ranking distribution summary for a domain
 *   dfs.keywordGap           — keywords competitor ranks for that you don't (gap view)
 *   dfs.listTrackedCompetitors   — list saved competitor domains for this user
 *   dfs.addTrackedCompetitor     — save a competitor domain to the tracking list
 *   dfs.removeTrackedCompetitor  — remove a competitor domain from the tracking list
 *   dfs.keywordVolumeForList     — batch volume lookup for a list of keywords (for GSC badges)
 *   dfs.saveKeywordSearch    — save a keyword lookup to the history log
 *   dfs.getKeywordHistory    — retrieve past keyword searches (most recent first)
 *   dfs.toggleKeywordFavorite — toggle isFavorite flag on a saved keyword search
 *   dfs.deleteKeywordSearch  — delete a keyword search from history
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { competitorDomains, keywordSearches } from "../drizzle/schema";
import {
  testCredentials,
  getKeywordOverview,
  getKeywordsForSite,
  getCompetitorDomains,
  getDomainIntersection,
  getRankedKeywords,
  getDomainRankOverview,
  getKeywordGap,
} from "./dataForSeo";

export const dataForSeoRouter = router({
  // ── Credential / account status ──────────────────────────────────────────
  status: protectedProcedure.query(async () => {
    try {
      const result = await testCredentials();
      return { connected: true, login: result.login, balance: result.balance };
    } catch {
      return { connected: false, login: null, balance: 0 };
    }
  }),

  // ── Keyword overview: volume, CPC, difficulty, intent ────────────────────
  keywordOverview: protectedProcedure
    .input(
      z.object({
        keywords: z.array(z.string().min(1)).min(1).max(20),
      })
    )
    .query(async ({ input }) => {
      const items = await getKeywordOverview(input.keywords);
      return { items };
    }),

  // ── Batch keyword volume lookup (for GSC striking-distance badges) ────────
  // Accepts up to 50 keywords, returns a map of keyword → search_volume
  keywordVolumeForList: protectedProcedure
    .input(
      z.object({
        keywords: z.array(z.string().min(1)).min(1).max(50),
      })
    )
    .query(async ({ input }) => {
      // getKeywordOverview handles up to 20 per call; chunk if needed
      const chunks: string[][] = [];
      for (let i = 0; i < input.keywords.length; i += 20) {
        chunks.push(input.keywords.slice(i, i + 20));
      }
      const allItems: { keyword: string; search_volume: number | null }[] = [];
      for (const chunk of chunks) {
        const items = await getKeywordOverview(chunk);
        allItems.push(
          ...items.map((item) => ({
            keyword: item.keyword,
            search_volume: item.search_volume ?? null,
          }))
        );
      }
      // Return as a plain object map for easy lookup on the frontend
      const volumeMap: Record<string, number | null> = {};
      for (const item of allItems) {
        volumeMap[item.keyword] = item.search_volume;
      }
      return { volumeMap };
    }),

  // ── Keywords a domain ranks for ──────────────────────────────────────────
  keywordsForSite: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const result = await getKeywordsForSite(input.domain, input.limit, input.offset);
      return result;
    }),

  // ── Competitor domains ────────────────────────────────────────────────────
  competitors: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const result = await getCompetitorDomains(input.domain, input.limit);
      return result;
    }),

  // ── Domain intersection (shared keywords) ────────────────────────────────
  domainIntersection: protectedProcedure
    .input(
      z.object({
        target1: z.string().min(1),
        target2: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const result = await getDomainIntersection(input.target1, input.target2, input.limit);
      return result;
    }),

  // ── Ranked keywords for a competitor (gap analysis) ──────────────────────
  rankedKeywords: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(100),
      })
    )
    .query(async ({ input }) => {
      const result = await getRankedKeywords(input.domain, input.limit);
      return result;
    }),

  // ── Domain rank overview ──────────────────────────────────────────────────
  domainRankOverview: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const result = await getDomainRankOverview(input.domain);
      return result;
    }),

  // ── Keyword Gap: keywords competitor ranks for that you don't ────────────
  keywordGap: protectedProcedure
    .input(
      z.object({
        myDomain: z
          .string()
          .min(1)
          .transform((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")),
        competitorDomain: z
          .string()
          .min(1)
          .transform((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const result = await getKeywordGap(input.myDomain, input.competitorDomain, input.limit);
      return result;
    }),

  // ── Competitor tracking list ──────────────────────────────────────────────

  listTrackedCompetitors: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const rows = await db!
      .select()
      .from(competitorDomains)
      .where(eq(competitorDomains.userId, ctx.user.id))
      .orderBy(competitorDomains.addedAt);
    return { competitors: rows };
  }),

  addTrackedCompetitor: protectedProcedure
    .input(
      z.object({
        domain: z
          .string()
          .min(1)
          .max(253)
          .transform((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Prevent duplicates for this user
      const existing = await db!
        .select({ id: competitorDomains.id })
        .from(competitorDomains)
        .where(
          and(
            eq(competitorDomains.userId, ctx.user.id),
            eq(competitorDomains.domain, input.domain)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        return { id: existing[0].id, domain: input.domain, alreadyExists: true };
      }
      const [result] = await db!.insert(competitorDomains).values({
        userId: ctx.user.id,
        domain: input.domain,
        label: input.label ?? null,
      });
      return { id: result.insertId, domain: input.domain, alreadyExists: false };
    }),

  removeTrackedCompetitor: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!
        .delete(competitorDomains)
        .where(
          and(
            eq(competitorDomains.id, input.id),
            eq(competitorDomains.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ── Keyword Search History ────────────────────────────────────────────────

  /**
   * Save a keyword lookup to the history log.
   * Called automatically whenever the user runs a keyword overview search.
   * Deduplicates by keyword (updates existing row if found within 24h).
   */
  saveKeywordSearch: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(512),
        searchVolume: z.number().int().nullable().optional(),
        difficulty: z.number().int().nullable().optional(),
        cpc: z.string().nullable().optional(),
        intent: z.string().nullable().optional(),
        trendData: z.string().nullable().optional(), // JSON string
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Check if this keyword was already searched by this user in the last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db!
        .select({ id: keywordSearches.id })
        .from(keywordSearches)
        .where(
          and(
            eq(keywordSearches.keyword, input.keyword),
            eq(keywordSearches.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update metrics on the existing row (keep isFavorite unchanged)
        await db!
          .update(keywordSearches)
          .set({
            searchVolume: input.searchVolume ?? null,
            difficulty: input.difficulty ?? null,
            cpc: input.cpc ?? null,
            intent: input.intent ?? null,
            trendData: input.trendData ?? null,
          })
          .where(eq(keywordSearches.id, existing[0].id));
        return { id: existing[0].id, created: false };
      }

      const [result] = await db!.insert(keywordSearches).values({
        keyword: input.keyword,
        searchVolume: input.searchVolume ?? null,
        difficulty: input.difficulty ?? null,
        cpc: input.cpc ?? null,
        intent: input.intent ?? null,
        trendData: input.trendData ?? null,
        isFavorite: false,
        userId: ctx.user.id,
      });
      return { id: result.insertId, created: true };
    }),

  /**
   * Retrieve past keyword searches for the current user, most recent first.
   * Optionally filter to favorites only.
   */
  getKeywordHistory: protectedProcedure
    .input(
      z.object({
        favoritesOnly: z.boolean().default(false),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const conditions = [eq(keywordSearches.userId, ctx.user.id)];
      if (input.favoritesOnly) {
        conditions.push(eq(keywordSearches.isFavorite, true));
      }
      const rows = await db!
        .select()
        .from(keywordSearches)
        .where(and(...conditions))
        .orderBy(desc(keywordSearches.createdAt))
        .limit(input.limit);
      return { searches: rows };
    }),

  /**
   * Toggle the isFavorite flag on a saved keyword search.
   */
  toggleKeywordFavorite: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Fetch current state
      const [row] = await db!
        .select({ id: keywordSearches.id, isFavorite: keywordSearches.isFavorite })
        .from(keywordSearches)
        .where(
          and(
            eq(keywordSearches.id, input.id),
            eq(keywordSearches.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!row) throw new Error("Keyword search not found");
      const newValue = !row.isFavorite;
      await db!
        .update(keywordSearches)
        .set({ isFavorite: newValue })
        .where(eq(keywordSearches.id, input.id));
      return { id: input.id, isFavorite: newValue };
    }),

  /**
   * Delete a keyword search from history.
   */
  deleteKeywordSearch: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!
        .delete(keywordSearches)
        .where(
          and(
            eq(keywordSearches.id, input.id),
            eq(keywordSearches.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),
});
