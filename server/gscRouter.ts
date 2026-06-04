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
   * Processes up to 10 URLs sequentially with logging.
   */
  bulkRequestIndexing: protectedProcedure
    .input(z.object({ urls: z.array(z.string().url()).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      const db = await getDb();
      const { gscIndexingLog } = await import("../drizzle/schema");
      const results = [];
      for (const url of input.urls) {
        try {
          const result = await requestIndexing(creds.gscRefreshToken!, url);
          results.push({ url, ...result });
          if (db) {
            await db.insert(gscIndexingLog).values({
              userId: String(ctx.user.id),
              url,
              success: result.success,
              message: result.message,
              source: "manual",
              submittedAt: Date.now(),
            });
          }
        } catch (err: any) {
          results.push({ url, success: false, message: err?.message ?? "Request failed" });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      return results;
    }),

  /**
   * Backfill indexing — submit all published posts in wp_post_index that have
   * not yet been logged in gsc_indexing_log.
   *
   * dryRun=true  → returns counts only, no submissions made
   * dryRun=false → kicks off a fire-and-forget background job and returns
   *                immediately so the HTTP request doesn't time out.
   *                Poll getIndexingLog to watch progress.
   */
  backfillIndexing: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { wpPostIndex, gscIndexingLog } = await import("../drizzle/schema");
      const { isNotNull, ne } = await import("drizzle-orm");

      // Get all published post URLs from wp_post_index
      const allPosts = await db
        .select({ wpPostId: wpPostIndex.wpPostId, url: wpPostIndex.url, title: wpPostIndex.title })
        .from(wpPostIndex)
        .where(isNotNull(wpPostIndex.url));

      // Get all URLs already logged
      const alreadyLogged = await db
        .select({ url: gscIndexingLog.url })
        .from(gscIndexingLog)
        .where(ne(gscIndexingLog.url, ""));

      const loggedUrls = new Set(alreadyLogged.map((r) => r.url));
      const unsubmitted = allPosts.filter((p) => p.url && !loggedUrls.has(p.url));

      if (input.dryRun) {
        return {
          dryRun: true,
          totalPublished: allPosts.length,
          alreadySubmitted: loggedUrls.size,
          toSubmit: unsubmitted.length,
          urls: unsubmitted.slice(0, 20).map((p) => p.url),
          submitted: 0,
          succeeded: 0,
          failed: 0,
          jobStarted: false,
        };
      }

      if (unsubmitted.length === 0) {
        return {
          dryRun: false,
          totalPublished: allPosts.length,
          alreadySubmitted: loggedUrls.size,
          toSubmit: 0,
          submitted: 0,
          succeeded: 0,
          failed: 0,
          jobStarted: false,
        };
      }

      // Fire-and-forget background job — returns immediately so HTTP doesn't time out.
      // The job runs in the background; poll getIndexingLog to watch progress.
      const userId = ctx.user.id;
      const refreshToken = creds.gscRefreshToken!;
      const toSubmit = [...unsubmitted]; // snapshot

      setImmediate(async () => {
        for (const post of toSubmit) {
          if (!post.url) continue;
          try {
            const result = await requestIndexing(refreshToken, post.url);
            await db!.insert(gscIndexingLog).values({
              userId: String(userId),
              url: post.url,
              wpPostId: post.wpPostId ?? undefined,
              success: result.success,
              message: result.message,
              source: "backfill",
              submittedAt: Date.now(),
            }).catch(() => {});
          } catch (err: any) {
            await db!.insert(gscIndexingLog).values({
              userId: String(userId),
              url: post.url,
              wpPostId: post.wpPostId ?? undefined,
              success: false,
              message: err?.message ?? "Request failed",
              source: "backfill",
              submittedAt: Date.now(),
            }).catch(() => {});
          }
          // 300ms gap between requests to respect Google Indexing API rate limits
          await new Promise((r) => setTimeout(r, 300));
        }
        console.log(`[GSC Backfill] Completed: ${toSubmit.length} URLs processed for user ${userId}`);
      });

      return {
        dryRun: false,
        totalPublished: allPosts.length,
        alreadySubmitted: loggedUrls.size,
        toSubmit: unsubmitted.length,
        submitted: 0,
        succeeded: 0,
        failed: 0,
        jobStarted: true,
      };
    }),

  /**
   * Get indexing log — shows which URLs have been submitted and their status.
   */
  getIndexingLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), source: z.enum(["auto_publish", "backfill", "manual", "all"]).default("all") }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { gscIndexingLog } = await import("../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");

      const rows = input.source === "all"
        ? await db.select().from(gscIndexingLog).orderBy(desc(gscIndexingLog.submittedAt)).limit(input.limit)
        : await db.select().from(gscIndexingLog).where(eq(gscIndexingLog.source, input.source as "auto_publish" | "backfill" | "manual")).orderBy(desc(gscIndexingLog.submittedAt)).limit(input.limit);

      const total = await db.select({ count: gscIndexingLog.id }).from(gscIndexingLog);
      return { rows, total: total.length };
    }),

  /**
   * GSC Content Flywheel — "Listen Again" step.
   * Compares current GSC positions against positions recorded 14–28 days ago.
   * Returns posts that have moved significantly (up or down) in rankings.
   * These are the posts that need follow-up content or a refresh.
   */
  getMovingPosts: protectedProcedure
    .input(z.object({ minMovement: z.number().min(1).max(30).default(3) }))
    .query(async ({ ctx, input }) => {
      const creds = await getGscCredentials(ctx.user.id);
      if (!creds.gscSiteUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site URL configured." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch current top pages from GSC (last 28 days)
      const currentPages = await getTopPages(creds.gscRefreshToken!, creds.gscSiteUrl, 200);

      // Fetch historical position data from gsc_position_history (14-28 days ago)
      const { gscPositionHistory, contentItems } = await import("../drizzle/schema");
      const { gte, lte, desc, eq } = await import("drizzle-orm");
      const now = Date.now();
      const fourteenDaysAgoMs = now - 14 * 24 * 60 * 60 * 1000;
      const twentyEightDaysAgoMs = now - 28 * 24 * 60 * 60 * 1000;

      const historicalRows = await db
        .select()
        .from(gscPositionHistory)
        .where(
          // recordedAt is stored as bigint Unix ms
          // We want records from 14-28 days ago (the "old" snapshot)
          // Using gte/lte on the bigint column
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (gte as any)(gscPositionHistory.recordedAt, twentyEightDaysAgoMs)
        )
        .orderBy(desc(gscPositionHistory.recordedAt))
        .limit(500);

      // Build a map of URL -> oldest position in the history window
      const historicalMap = new Map<string, { position: number; recordedAt: number }>();
      for (const row of historicalRows) {
        if (!row.url) continue;
        const normalUrl = row.url.replace(/\/$/, "");
        const pos = parseFloat(row.position ?? "0");
        const existing = historicalMap.get(normalUrl);
        // Keep the oldest record (furthest back in time = smallest timestamp) for best comparison
        if (!existing || row.recordedAt < existing.recordedAt) {
          historicalMap.set(normalUrl, { position: pos, recordedAt: row.recordedAt });
        }
      }

      // Also fetch published content items to get titles and focus keywords
      const publishedPosts = await db
        .select({
          id: contentItems.id,
          title: contentItems.title,
          publishUrl: contentItems.publishUrl,
          focusKeyword: contentItems.focusKeyword,
          status: contentItems.status,
        })
        .from(contentItems)
        .where(eq(contentItems.status, "published"))
        .limit(500);

      const postMap = new Map<string, { id: number; title: string; focusKeyword: string | null }>();
      for (const post of publishedPosts) {
        if (post.publishUrl) {
          postMap.set(post.publishUrl.replace(/\/$/, ""), {
            id: post.id,
            title: post.title ?? "",
            focusKeyword: post.focusKeyword ?? null,
          });
        }
      }

      // Compare current vs historical positions
      const movingPosts: Array<{
        url: string;
        title: string;
        focusKeyword: string | null;
        currentPosition: number;
        previousPosition: number;
        positionDelta: number;
        direction: "up" | "down" | "new";
        currentClicks: number;
        currentImpressions: number;
        signal: "rising_star" | "slipping" | "breakthrough" | "needs_refresh";
        recommendation: string;
        contentItemId: number | null;
      }> = [];

      for (const page of currentPages) {
        const pageUrl = page.page; // PageRow uses 'page' field, not 'url'
        const url = pageUrl.replace(/\/$/, "");
        const currentPos = page.position;
        const historical = historicalMap.get(url);
        const postInfo = postMap.get(url);

        if (historical) {
          const delta = historical.position - currentPos; // positive = moved up (improved)
          if (Math.abs(delta) >= input.minMovement) {
            const direction: "up" | "down" = delta > 0 ? "up" : "down";

            // Classify the signal
            let signal: "rising_star" | "slipping" | "breakthrough" | "needs_refresh";
            let recommendation: string;

            if (direction === "up" && currentPos <= 10) {
              signal = "breakthrough";
              recommendation = `This page broke into the top 10! Publish a follow-up or supporting article on "${postInfo?.focusKeyword ?? pageUrl.split("/").pop()}" to capture more of this traffic cluster.`;
            } else if (direction === "up" && currentPos <= 20) {
              signal = "rising_star";
              recommendation = `Rising fast — moved up ${Math.abs(delta).toFixed(0)} positions. Add internal links from your pillar page and publish a supporting article to push it into the top 10.`;
            } else if (direction === "down" && currentPos > 20) {
              signal = "slipping";
              recommendation = `Slipping — dropped ${Math.abs(delta).toFixed(0)} positions. Refresh the article with updated stats, add 2–3 new sections, and re-submit for indexing.`;
            } else {
              signal = "needs_refresh";
              recommendation = `Position shifted ${Math.abs(delta).toFixed(0)} places. Review the content for freshness and consider a supporting short-form video on this topic.`;
            }

            movingPosts.push({
              url: pageUrl,
              title: postInfo?.title ?? pageUrl.split("/").filter(Boolean).pop() ?? pageUrl,
              focusKeyword: postInfo?.focusKeyword ?? null,
              currentPosition: Math.round(currentPos * 10) / 10,
              previousPosition: Math.round(historical.position * 10) / 10,
              positionDelta: Math.round(delta * 10) / 10,
              direction,
              currentClicks: page.clicks,
              currentImpressions: page.impressions,
              signal,
              recommendation,
              contentItemId: postInfo?.id ?? null,
            });
          }
        } else if (currentPos <= 15 && page.clicks > 5) {
          // New page appearing in top 15 with clicks — worth surfacing
          movingPosts.push({
            url: pageUrl,
            title: postInfo?.title ?? pageUrl.split("/").filter(Boolean).pop() ?? pageUrl,
            focusKeyword: postInfo?.focusKeyword ?? null,
            currentPosition: Math.round(currentPos * 10) / 10,
            previousPosition: 0,
            positionDelta: 0,
            direction: "new",
            currentClicks: page.clicks,
            currentImpressions: page.impressions,
            signal: "rising_star",
            recommendation: `New page appearing in top 15 with ${page.clicks} clicks. Build supporting content around this topic to consolidate the ranking.`,
            contentItemId: postInfo?.id ?? null,
          });
        }
      }

      // Sort: breakthroughs first, then rising stars, then slipping, then needs_refresh
      const signalOrder = { breakthrough: 0, rising_star: 1, slipping: 2, needs_refresh: 3 };
      movingPosts.sort((a, b) => {
        const orderDiff = signalOrder[a.signal] - signalOrder[b.signal];
        if (orderDiff !== 0) return orderDiff;
        return Math.abs(b.positionDelta) - Math.abs(a.positionDelta);
      });

      return {
        posts: movingPosts.slice(0, 20),
        totalAnalyzed: currentPages.length,
        historicalDataPoints: historicalRows.length,
        hasHistoricalData: historicalRows.length > 0,
      };
    }),

  /**
   * GSC Content Flywheel — AI-powered follow-up content suggestion.
   * Given a moving post, generates a specific follow-up article or video brief.
   */
  suggestFollowUp: protectedProcedure
    .input(z.object({
      url: z.string(),
      title: z.string(),
      focusKeyword: z.string().nullable(),
      signal: z.enum(["rising_star", "slipping", "breakthrough", "needs_refresh"]),
      currentPosition: z.number(),
      positionDelta: z.number(),
      contentType: z.enum(["blog", "video", "both"]).default("both"),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");

      const signalContext = {
        breakthrough: `This article just broke into the top 10 on Google (position ${input.currentPosition.toFixed(1)}), gaining ${Math.abs(input.positionDelta).toFixed(0)} positions. This is a momentum signal — the topic cluster is hot.`,
        rising_star: `This article is climbing fast (now position ${input.currentPosition.toFixed(1)}, up ${Math.abs(input.positionDelta).toFixed(0)} positions). It's approaching the top 10 and needs a push.`,
        slipping: `This article is losing ground (now position ${input.currentPosition.toFixed(1)}, dropped ${Math.abs(input.positionDelta).toFixed(0)} positions). It needs a refresh or supporting content.`,
        needs_refresh: `This article has shifted in rankings (position ${input.currentPosition.toFixed(1)}). It may need updated content or supporting articles.`,
      }[input.signal];

      const prompt = `You are the CMO for The Urban Monk, Dr. Pedram Shojai's health and wellness brand. You are analyzing a GSC ranking signal and must recommend specific follow-up content.

ARTICLE: "${input.title}"
FOCUS KEYWORD: ${input.focusKeyword ?? "(unknown)"}
URL: ${input.url}
SIGNAL: ${signalContext}

Generate a specific, actionable follow-up content plan. Return JSON with this exact structure:
{
  "blogIdea": {
    "title": "exact article title",
    "focusKeyword": "exact keyword to target",
    "angle": "1-2 sentence description of the unique angle",
    "outline": ["H2 section 1", "H2 section 2", "H2 section 3", "H2 section 4"],
    "internalLinkOpportunity": "which existing article to link from"
  },
  "videoIdea": {
    "title": "exact YouTube video title",
    "hook": "first 2 sentences of the script (the viral hook)",
    "platform": "YouTube or YouTube Short or both",
    "cta": "specific CTA to Urban Monk Academy or Lights On supplement"
  },
  "urgency": "high|medium|low",
  "reasoning": "1 sentence explaining why this specific follow-up will move the needle"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a senior SEO strategist and content director. Always return valid JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try {
        return JSON.parse(content);
      } catch {
        return { error: "Failed to parse suggestion", raw: content };
      }
    }),
});
