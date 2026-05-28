/**
 * Google Search Console tRPC Router
 * Provides SEO data procedures for the SEO Dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  getTopQueries,
  getTopPages,
  getStrikingDistanceKeywords,
  getWeekOverWeekSummary,
  listGscSites,
  inspectUrl,
  requestIndexing,
} from "./googleSearchConsole";

async function getGscCredentials(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const { userCredentials } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [creds] = await db.select().from(userCredentials).where(eq(userCredentials.userId, userId));
  if (!creds?.gscRefreshToken) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Google Search Console not connected. Visit /api/gsc/auth-url to connect.",
    });
  }
  return creds;
}

export const gscRouter = router({
  /** Check if GSC is connected and return the configured site URL */
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { connected: false, siteUrl: null };
    const { userCredentials } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [creds] = await db.select().from(userCredentials).where(eq(userCredentials.userId, ctx.user.id));
    return {
      connected: !!creds?.gscRefreshToken,
      siteUrl: creds?.gscSiteUrl ?? null,
    };
  }),

  /** List all Search Console properties available to the authorized account */
  listSites: protectedProcedure.query(async ({ ctx }) => {
    const creds = await getGscCredentials(ctx.user.id);
    const sites = await listGscSites(creds.gscRefreshToken!);
    return { sites };
  }),

  /** Set the active site URL to query */
  setSiteUrl: protectedProcedure
    .input(z.object({ siteUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { userCredentials } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [existing] = await db.select().from(userCredentials).where(eq(userCredentials.userId, ctx.user.id));
      if (existing) {
        await db.update(userCredentials).set({ gscSiteUrl: input.siteUrl }).where(eq(userCredentials.userId, ctx.user.id));
      } else {
        await db.insert(userCredentials).values({ userId: ctx.user.id, gscSiteUrl: input.siteUrl });
      }
      return { success: true };
    }),

  /** Disconnect GSC by clearing the stored refresh token */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { userCredentials } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(userCredentials)
      .set({ gscRefreshToken: null, gscSiteUrl: null })
      .where(eq(userCredentials.userId, ctx.user.id));
    return { success: true };
  }),

  /** Week-over-week summary: clicks and impressions delta */
  weekOverWeek: protectedProcedure.query(async ({ ctx }) => {
    const creds = await getGscCredentials(ctx.user.id);
    if (!creds.gscSiteUrl) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured. Please select a site first." });
    }
    return getWeekOverWeekSummary(creds.gscRefreshToken!, creds.gscSiteUrl);
  }),

  /** Top 20 queries by clicks over the last 28 days */
  topQueries: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      if (!creds.gscSiteUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
      }
      return getTopQueries(creds.gscRefreshToken!, creds.gscSiteUrl, input.limit);
    }),

  /** Top 20 pages by clicks over the last 28 days */
  topPages: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      if (!creds.gscSiteUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
      }
      return getTopPages(creds.gscRefreshToken!, creds.gscSiteUrl, input.limit);
    }),

  /** Striking-distance keywords: positions 11-20 with >50 impressions */
  strikingDistance: protectedProcedure.query(async ({ ctx }) => {
    const creds = await getGscCredentials(ctx.user.id);
    if (!creds.gscSiteUrl) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
    }
    return getStrikingDistanceKeywords(creds.gscRefreshToken!, creds.gscSiteUrl);
  }),

  /**
   * Record that a keyword was sent to Video Production or Blog Generator.
   * Called client-side when the user clicks a "Create Content" button.
   */
  trackKeywordSend: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(512),
        contentType: z.enum(["video", "blog"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { seoContentTracker } = await import("../drizzle/schema");
      await db.insert(seoContentTracker).values({
        userId: ctx.user.id,
        keyword: input.keyword.toLowerCase().trim(),
        contentType: input.contentType,
      });
      return { success: true };
    }),

  /**
   * Return the set of keywords (lowercased) that have already been sent to
   * content generators by this user, along with their content types.
   * Used by the SEO dashboard to render "content created" badges.
   */
  trackedKeywords: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const { seoContentTracker } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(seoContentTracker)
      .where(eq(seoContentTracker.userId, ctx.user.id))
      .orderBy(desc(seoContentTracker.createdAt));
    return rows;
  }),

  /**
   * Sync GSC query positions into keyword_targets.currentPosition.
   * Fetches up to 500 GSC queries for the last 28 days, then fuzzy-matches
   * each keyword target by exact string (case-insensitive) or substring.
   * Returns counts of matched and unmatched targets.
   */
  syncPositionsToKeywordTargets: protectedProcedure.mutation(async ({ ctx }) => {
    const creds = await getGscCredentials(ctx.user.id);
    if (!creds.gscSiteUrl) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { keywordTargets } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    // Fetch up to 500 GSC queries (broad, not just striking distance)
    const gscRows = await getTopQueries(creds.gscRefreshToken!, creds.gscSiteUrl, 500);
    // Build a lookup map: normalised query -> position
    const gscMap = new Map<string, number>();
    for (const row of gscRows) {
      gscMap.set(row.query.toLowerCase().trim(), row.position);
    }

    // Load all keyword targets for this user
    const targets = await db
      .select()
      .from(keywordTargets)
      .where(eq(keywordTargets.userId, ctx.user.id));

    let matched = 0;
    let unmatched = 0;

    for (const target of targets) {
      const normalised = target.keyword.toLowerCase().trim();
      // 1. Exact match
      let position = gscMap.get(normalised);
      // 2. Substring match: find the GSC query that contains this keyword
      if (position === undefined) {
        for (const [gscQuery, pos] of Array.from(gscMap.entries())) {
          if (gscQuery.includes(normalised) || normalised.includes(gscQuery)) {
            position = pos;
            break;
          }
        }
      }

      if (position !== undefined) {
        await db
          .update(keywordTargets)
          .set({ currentPosition: position.toFixed(1) })
          .where(eq(keywordTargets.id, target.id));
        matched++;
      } else {
        unmatched++;
      }
    }

    return {
      success: true,
      matched,
      unmatched,
      total: targets.length,
      gscQueriesFetched: gscRows.length,
    };
  }),

  /**
   * Inspect a single URL's indexing status via the GSC URL Inspection API.
   * Returns coverage state, last crawl time, and verdict.
   */
  inspectUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      if (!creds.gscSiteUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
      }
      return inspectUrl(creds.gscRefreshToken!, creds.gscSiteUrl, input.url);
    }),

  /**
   * Bulk inspect up to 20 URLs at once (rate-limited to avoid GSC quota).
   * Returns an array of index status results in the same order as input.
   */
  bulkInspectUrls: protectedProcedure
    .input(z.object({ urls: z.array(z.string().url()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      if (!creds.gscSiteUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
      }
      // Process sequentially with a small delay to respect GSC rate limits (600 req/min)
      const results = [];
      for (const url of input.urls) {
        try {
          const status = await inspectUrl(creds.gscRefreshToken!, creds.gscSiteUrl, url);
          results.push({ url, status, error: null });
        } catch (err: any) {
          results.push({ url, status: null, error: err?.message ?? "Inspection failed" });
        }
        // Small delay between requests to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
      }
      return results;
    }),

  /**
   * Request indexing for a URL via the Google Indexing API.
   * Sends a URL_UPDATED notification which acts as a crawl hint.
   */
  requestIndexing: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      return requestIndexing(creds.gscRefreshToken!, input.url);
    }),

  /**
   * Bulk request indexing for multiple URLs.
   * Processes up to 10 URLs sequentially.
   */
  bulkRequestIndexing: protectedProcedure
    .input(z.object({ urls: z.array(z.string().url()).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      const results = [];
      for (const url of input.urls) {
        try {
          const result = await requestIndexing(creds.gscRefreshToken!, url);
          results.push({ url, ...result });
        } catch (err: any) {
          results.push({ url, success: false, message: err?.message ?? "Request failed" });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      return results;
    }),
});
