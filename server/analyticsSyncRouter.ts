/**
 * Analytics Sync Router
 *
 * Pulls real engagement data from platforms that expose it via API:
 *   - YouTube Data API v3: views, likes, comment count (requires youtubeVideoId on content item)
 *   - WordPress REST API: comment count (requires wpPostId on content item)
 *
 * Meta (Facebook/Instagram) and LinkedIn analytics require additional OAuth scopes
 * that are not currently connected, so those platforms are excluded from sync.
 * Buffer does not expose post-level analytics via its API.
 *
 * Content items with neither youtubeVideoId nor wpPostId are skipped — the UI
 * should display "—" for those items instead of zeros.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { contentItems, userCredentials } from "../drizzle/schema";
import { eq, inArray, and, isNotNull, or } from "drizzle-orm";
import { getYouTubeClient } from "./youtubeOAuth";

// ─── WordPress helpers ────────────────────────────────────────────────────────

function getWpAuth() {
  const baseUrl = process.env.WORDPRESS_URL?.replace(/\/$/, "") ?? "";
  const username = process.env.WORDPRESS_USERNAME ?? "";
  const password = process.env.WORDPRESS_APP_PASSWORD ?? "";
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  return { baseUrl, authHeader };
}

/**
 * Fetch comment_count for a single WordPress post.
 * Returns null if the post is not found or the API is unavailable.
 */
async function fetchWpCommentCount(wpPostId: number): Promise<number | null> {
  const { baseUrl, authHeader } = getWpAuth();
  if (!baseUrl) return null;

  try {
    const res = await fetch(
      `${baseUrl}/wp-json/wp/v2/posts/${wpPostId}?_fields=id,comment_count`,
      {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { comment_count?: number };
    return typeof data.comment_count === "number" ? data.comment_count : null;
  } catch {
    return null;
  }
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

/**
 * Fetch statistics for up to 50 YouTube video IDs in a single API call.
 * Returns a map of videoId → { views, likes, comments }.
 */
async function fetchYouTubeStats(
  videoIds: string[],
  refreshToken: string
): Promise<Map<string, { views: number; likes: number; comments: number }>> {
  const result = new Map<string, { views: number; likes: number; comments: number }>();
  if (videoIds.length === 0) return result;

  try {
    const youtube = getYouTubeClient(refreshToken);
    // YouTube API allows up to 50 IDs per request
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const res = await youtube.videos.list({
        part: ["statistics"],
        id: chunk,
      });

      for (const item of res.data.items ?? []) {
        const stats = item.statistics;
        if (!item.id || !stats) continue;
        result.set(item.id, {
          views: parseInt(stats.viewCount ?? "0", 10),
          likes: parseInt(stats.likeCount ?? "0", 10),
          comments: parseInt(stats.commentCount ?? "0", 10),
        });
      }
    }
  } catch (err) {
    console.error("[analyticsSync] YouTube stats fetch error:", err);
  }

  return result;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const analyticsSyncRouter = router({
  /**
   * Sync analytics for all published content items that have a youtubeVideoId or wpPostId.
   * Returns a summary of how many items were updated and any errors encountered.
   */
  syncAll: protectedProcedure
    .input(
      z.object({
        /** Optionally restrict to specific content item IDs */
        ids: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // 1. Fetch all published items that have a syncable identifier
      let query = db
        .select({
          id: contentItems.id,
          wpPostId: contentItems.wpPostId,
          youtubeVideoId: contentItems.youtubeVideoId,
          platform: contentItems.platform,
        })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.status, "published"),
            or(
              isNotNull(contentItems.wpPostId),
              isNotNull(contentItems.youtubeVideoId)
            )
          )
        );

      const allItems = await query;

      // Filter by specific IDs if provided
      const items = input.ids && input.ids.length > 0
        ? allItems.filter(item => input.ids!.includes(item.id))
        : allItems;

      if (items.length === 0) {
        return { updated: 0, skipped: 0, errors: 0, details: [] };
      }

      // 2. Get YouTube refresh token (needed for YT stats)
      let youtubeRefreshToken: string | null = null;
      try {
        const [creds] = await db
          .select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken })
          .from(userCredentials)
          .where(eq(userCredentials.userId, 1))
          .limit(1);
        youtubeRefreshToken = (creds as any)?.youtubeRefreshToken ?? process.env.YOUTUBE_REFRESH_TOKEN ?? null;
      } catch {
        youtubeRefreshToken = process.env.YOUTUBE_REFRESH_TOKEN ?? null;
      }

      // 3. Batch-fetch YouTube stats for all items with youtubeVideoId
      const ytItems = items.filter(i => !!i.youtubeVideoId);
      const ytVideoIds = ytItems.map(i => i.youtubeVideoId!);
      let ytStatsMap = new Map<string, { views: number; likes: number; comments: number }>();

      if (ytVideoIds.length > 0 && youtubeRefreshToken) {
        ytStatsMap = await fetchYouTubeStats(ytVideoIds, youtubeRefreshToken);
      }

      // 4. Process each item
      const details: Array<{
        id: number;
        source: "youtube" | "wordpress" | "none";
        views: number | null;
        likes: number | null;
        comments: number | null;
        error?: string;
      }> = [];

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const item of items) {
        try {
          // YouTube takes priority if both IDs are present
          if (item.youtubeVideoId && ytStatsMap.has(item.youtubeVideoId)) {
            const stats = ytStatsMap.get(item.youtubeVideoId)!;
            await db
              .update(contentItems)
              .set({
                analyticsViews: stats.views,
                analyticsLikes: stats.likes,
                analyticsComments: stats.comments,
                // analyticsSource stored as a note in the notes field is too invasive;
                // we track source implicitly via youtubeVideoId presence
              })
              .where(eq(contentItems.id, item.id));

            details.push({
              id: item.id,
              source: "youtube",
              views: stats.views,
              likes: stats.likes,
              comments: stats.comments,
            });
            updated++;
          } else if (item.wpPostId) {
            // WordPress: only comment count is reliably available without Jetpack
            const commentCount = await fetchWpCommentCount(item.wpPostId);
            if (commentCount !== null) {
              await db
                .update(contentItems)
                .set({
                  analyticsComments: commentCount,
                  // Do NOT overwrite views/likes — those may have been manually entered
                  // or synced from YouTube previously
                })
                .where(eq(contentItems.id, item.id));

              details.push({
                id: item.id,
                source: "wordpress",
                views: null, // WP REST API doesn't expose page views without Jetpack
                likes: null, // WP doesn't have likes
                comments: commentCount,
              });
              updated++;
            } else {
              details.push({ id: item.id, source: "wordpress", views: null, likes: null, comments: null, error: "WP fetch returned null" });
              skipped++;
            }
          } else {
            // Has youtubeVideoId but YouTube fetch failed (no token or API error)
            details.push({ id: item.id, source: "none", views: null, likes: null, comments: null, error: "YouTube token not available or video not found" });
            skipped++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          details.push({ id: item.id, source: "none", views: null, likes: null, comments: null, error: msg });
          errors++;
        }
      }

      return {
        updated,
        skipped,
        errors,
        youtubeConnected: !!youtubeRefreshToken,
        details,
      };
    }),

  /**
   * Get the analytics sync status — tells the UI which items have syncable identifiers
   * and what source they will be synced from.
   */
  getSyncStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { ytCount: 0, wpCount: 0, noneCount: 0, youtubeConnected: false };

    const items = await db
      .select({
        id: contentItems.id,
        wpPostId: contentItems.wpPostId,
        youtubeVideoId: contentItems.youtubeVideoId,
      })
      .from(contentItems)
      .where(eq(contentItems.status, "published"));

    let ytCount = 0;
    let wpCount = 0;
    let noneCount = 0;

    for (const item of items) {
      if (item.youtubeVideoId) ytCount++;
      else if (item.wpPostId) wpCount++;
      else noneCount++;
    }

    // Check if YouTube is connected
    let youtubeConnected = !!process.env.YOUTUBE_REFRESH_TOKEN;
    try {
      const [creds] = await db
        .select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken })
        .from(userCredentials)
        .where(eq(userCredentials.userId, 1))
        .limit(1);
      if ((creds as any)?.youtubeRefreshToken) youtubeConnected = true;
    } catch { /* ignore */ }

    return { ytCount, wpCount, noneCount, youtubeConnected };
  }),
});
