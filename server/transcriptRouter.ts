/**
 * Transcript Engine Router — Phase A
 *
 * Supadata-powered YouTube transcript fetcher with:
 * - 25/day quota ledger (enforced before every call)
 * - Channel backfill: fetches video IDs from YouTube Data API, then pulls transcripts via Supadata
 * - Manual transcript paste (for videos Supadata can't reach)
 * - Transcript library with filtering
 *
 * Architecture:
 *   YouTube Data API → video IDs + metadata
 *   Supadata API     → transcript text (per video ID)
 *   yt_quota_ledger  → daily cap enforcement
 *   yt_transcripts   → stored transcripts
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { ytQuotaLedger, ytTranscripts } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { getYTClient } from "./youtubeRouter";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPADATA_BASE = "https://api.supadata.ai/v1";
const DEFAULT_DAILY_LIMIT = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Get or create today's quota ledger row.
 * Returns { unitsUsed, dailyLimit, remaining }.
 */
async function getOrCreateQuota(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const today = todayStr();
  const [existing] = await db
    .select()
    .from(ytQuotaLedger)
    .where(eq(ytQuotaLedger.date, today))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      unitsUsed: existing.unitsUsed,
      dailyLimit: existing.dailyLimit,
      remaining: existing.dailyLimit - existing.unitsUsed,
    };
  }

  // Create new row for today
  await db.insert(ytQuotaLedger).values({
    date: today,
    unitsUsed: 0,
    dailyLimit: DEFAULT_DAILY_LIMIT,
  });

  const [created] = await db
    .select()
    .from(ytQuotaLedger)
    .where(eq(ytQuotaLedger.date, today))
    .limit(1);

  return {
    id: created!.id,
    unitsUsed: 0,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    remaining: DEFAULT_DAILY_LIMIT,
  };
}

/**
 * Increment today's quota by `count` units.
 */
async function incrementQuota(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  count = 1
) {
  const today = todayStr();
  await db
    .update(ytQuotaLedger)
    .set({ unitsUsed: sql`units_used + ${count}` })
    .where(eq(ytQuotaLedger.date, today));
}

/**
 * Fetch transcript from Supadata for a given YouTube video ID.
 * Returns { text, lang } or throws on error.
 */
async function fetchSupadataTranscript(videoId: string): Promise<{ text: string; lang: string }> {
  const apiKey = ENV.supadataApiKey;
  if (!apiKey) throw new Error("SUPADATA_API_KEY not configured");

  const url = `${SUPADATA_BASE}/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=en&text=true`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (body as { details?: string }).details ?? res.statusText;
    if (res.status === 404 || (body as { error?: string }).error === "not-found") {
      throw new Error("NO_TRANSCRIPT");
    }
    throw new Error(`Supadata error ${res.status}: ${detail}`);
  }

  const data = await res.json() as { lang?: string; content?: string };
  const text = data.content ?? "";
  const lang = data.lang ?? "en";

  if (!text || text.trim().length < 10) {
    throw new Error("NO_TRANSCRIPT");
  }

  return { text, lang };
}

/**
 * Get the owner's YouTube channel ID using the Data API.
 */
async function getOwnerChannelId(): Promise<string> {
  const yt = await getYTClient();
  const res = await yt.channels.list({ part: ["id"], mine: true });
  const channelId = res.data.items?.[0]?.id;
  if (!channelId) throw new Error("Could not resolve owner YouTube channel ID");
  return channelId;
}

/**
 * Get video IDs + metadata from the channel's uploads playlist.
 * Returns up to `maxResults` videos, oldest-first for backfill.
 */
async function getChannelVideoIds(
  maxResults = 50,
  pageToken?: string
): Promise<{ videoId: string; title: string; publishedAt: string | null; nextPageToken?: string }[]> {
  const yt = await getYTClient();
  const channelId = await getOwnerChannelId();

  // Get uploads playlist ID
  const chRes = await yt.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });
  const uploadsPlaylistId =
    chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Could not find uploads playlist");

  // Fetch playlist items
  const plRes = await yt.playlistItems.list({
    part: ["contentDetails", "snippet"],
    playlistId: uploadsPlaylistId,
    maxResults,
    ...(pageToken ? { pageToken } : {}),
  });

  const items = plRes.data.items ?? [];
  return items.map((item) => ({
    videoId: item.contentDetails?.videoId ?? "",
    title: item.snippet?.title ?? "",
    publishedAt: item.contentDetails?.videoPublishedAt ?? null,
    nextPageToken: plRes.data.nextPageToken ?? undefined,
  })).filter((v) => v.videoId);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const transcriptRouter = router({

  // ─── Get quota status ────────────────────────────────────────────────────────
  getQuotaStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { unitsUsed: 0, dailyLimit: DEFAULT_DAILY_LIMIT, remaining: DEFAULT_DAILY_LIMIT, date: todayStr() };

    const quota = await getOrCreateQuota(db);
    return { ...quota, date: todayStr() };
  }),

  // ─── Fetch single transcript ─────────────────────────────────────────────────
  fetchTranscript: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1).max(64),
        videoTitle: z.string().optional(),
        channelId: z.string().optional(),
        publishedAt: z.string().optional(), // ISO date string
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check if already fetched
      const [existing] = await db
        .select({ id: ytTranscripts.id, status: ytTranscripts.status })
        .from(ytTranscripts)
        .where(eq(ytTranscripts.videoId, input.videoId))
        .limit(1);

      if (existing?.status === "fetched") {
        return { success: true, status: "already_fetched", videoId: input.videoId };
      }

      // Check quota
      const quota = await getOrCreateQuota(db);
      if (quota.remaining <= 0) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily quota exhausted (${quota.unitsUsed}/${quota.dailyLimit}). Resets tomorrow.`,
        });
      }

      // Resolve channel ID
      let channelId = input.channelId;
      if (!channelId) {
        try {
          channelId = await getOwnerChannelId();
        } catch {
          channelId = "unknown";
        }
      }

      // Upsert a pending row first
      if (!existing) {
        await db.insert(ytTranscripts).values({
          videoId: input.videoId,
          channelId,
          videoTitle: input.videoTitle ?? null,
          publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
          status: "pending",
          provider: "supadata",
        });
      }

      // Fetch from Supadata
      try {
        const { text, lang } = await fetchSupadataTranscript(input.videoId);
        const wordCount = text.trim().split(/\s+/).length;

        await db
          .update(ytTranscripts)
          .set({
            rawText: text,
            wordCount,
            lang,
            status: "fetched",
            fetchedAt: new Date(),
            errorMessage: null,
          })
          .where(eq(ytTranscripts.videoId, input.videoId));

        await incrementQuota(db);

        return { success: true, status: "fetched", videoId: input.videoId, wordCount, lang };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const status = msg === "NO_TRANSCRIPT" ? "no_transcript" : "error";

        await db
          .update(ytTranscripts)
          .set({ status, errorMessage: msg === "NO_TRANSCRIPT" ? null : msg })
          .where(eq(ytTranscripts.videoId, input.videoId));

        if (msg !== "NO_TRANSCRIPT") {
          await incrementQuota(db); // Count failed API calls against quota too
        }

        return { success: false, status, videoId: input.videoId, error: msg };
      }
    }),

  // ─── Backfill channel (25/day cap) ───────────────────────────────────────────
  backfillChannel: protectedProcedure
    .input(
      z.object({
        maxVideos: z.number().min(1).max(50).default(25),
        pageToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const quota = await getOrCreateQuota(db);
      if (quota.remaining <= 0) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily quota exhausted (${quota.unitsUsed}/${quota.dailyLimit}). Resets tomorrow.`,
        });
      }

      const limit = Math.min(input.maxVideos, quota.remaining);

      // Get video IDs from YouTube Data API
      let videos: { videoId: string; title: string; publishedAt: string | null }[] = [];
      try {
        videos = await getChannelVideoIds(50, input.pageToken);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch channel videos: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }

      // Filter out already-fetched or no_transcript videos
      const existingRows = await db
        .select({ videoId: ytTranscripts.videoId, status: ytTranscripts.status })
        .from(ytTranscripts)
        .where(
          sql`video_id IN (${videos.map((v) => `'${v.videoId}'`).join(",")})`
        );

      const existingMap = new Map(existingRows.map((r) => [r.videoId, r.status]));
      const toFetch = videos
        .filter((v) => {
          const s = existingMap.get(v.videoId);
          return !s || s === "pending" || s === "error"; // retry errors
        })
        .slice(0, limit);

      if (toFetch.length === 0) {
        return {
          fetched: 0,
          noTranscript: 0,
          errors: 0,
          skipped: videos.length,
          quotaUsed: 0,
          quotaRemaining: quota.remaining,
          message: "All videos already processed",
        };
      }

      // Get channel ID once
      let channelId = "unknown";
      try {
        channelId = await getOwnerChannelId();
      } catch { /* ignore */ }

      let fetched = 0;
      let noTranscript = 0;
      let errors = 0;

      for (const video of toFetch) {
        // Upsert pending row
        const [existingRow] = await db
          .select({ id: ytTranscripts.id })
          .from(ytTranscripts)
          .where(eq(ytTranscripts.videoId, video.videoId))
          .limit(1);

        if (!existingRow) {
          await db.insert(ytTranscripts).values({
            videoId: video.videoId,
            channelId,
            videoTitle: video.title,
            publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
            status: "pending",
            provider: "supadata",
          });
        }

        try {
          const { text, lang } = await fetchSupadataTranscript(video.videoId);
          const wordCount = text.trim().split(/\s+/).length;

          await db
            .update(ytTranscripts)
            .set({
              rawText: text,
              wordCount,
              lang,
              status: "fetched",
              fetchedAt: new Date(),
              videoTitle: video.title,
              errorMessage: null,
            })
            .where(eq(ytTranscripts.videoId, video.videoId));

          await incrementQuota(db);
          fetched++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          if (msg === "NO_TRANSCRIPT") {
            await db
              .update(ytTranscripts)
              .set({ status: "no_transcript", videoTitle: video.title })
              .where(eq(ytTranscripts.videoId, video.videoId));
            noTranscript++;
          } else {
            await db
              .update(ytTranscripts)
              .set({ status: "error", errorMessage: msg, videoTitle: video.title })
              .where(eq(ytTranscripts.videoId, video.videoId));
            await incrementQuota(db);
            errors++;
          }
        }
      }

      const finalQuota = await getOrCreateQuota(db);

      return {
        fetched,
        noTranscript,
        errors,
        skipped: videos.length - toFetch.length,
        quotaUsed: finalQuota.unitsUsed,
        quotaRemaining: finalQuota.remaining,
        message: `Processed ${toFetch.length} videos: ${fetched} fetched, ${noTranscript} no transcript, ${errors} errors`,
      };
    }),

  // ─── List transcripts ────────────────────────────────────────────────────────
  listTranscripts: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "fetched", "no_transcript", "error"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.status) conditions.push(eq(ytTranscripts.status, input.status));
      if (input.search) {
        conditions.push(
          sql`(video_title LIKE ${`%${input.search}%`} OR video_id LIKE ${`%${input.search}%`})`
        );
      }

      const rows = await db
        .select({
          id: ytTranscripts.id,
          videoId: ytTranscripts.videoId,
          channelId: ytTranscripts.channelId,
          videoTitle: ytTranscripts.videoTitle,
          publishedAt: ytTranscripts.publishedAt,
          fetchedAt: ytTranscripts.fetchedAt,
          provider: ytTranscripts.provider,
          lang: ytTranscripts.lang,
          wordCount: ytTranscripts.wordCount,
          status: ytTranscripts.status,
          errorMessage: ytTranscripts.errorMessage,
          createdAt: ytTranscripts.createdAt,
        })
        .from(ytTranscripts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ytTranscripts.fetchedAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── Get single transcript (full text) ───────────────────────────────────────
  getTranscript: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(ytTranscripts)
        .where(eq(ytTranscripts.videoId, input.videoId))
        .limit(1);

      return row ?? null;
    }),

  // ─── Manual transcript paste ──────────────────────────────────────────────────
  pasteTranscript: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1).max(64),
        videoTitle: z.string().optional(),
        channelId: z.string().optional(),
        publishedAt: z.string().optional(),
        rawText: z.string().min(50, "Transcript must be at least 50 characters"),
        lang: z.string().default("en"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const wordCount = input.rawText.trim().split(/\s+/).length;
      let channelId = input.channelId;
      if (!channelId) {
        try { channelId = await getOwnerChannelId(); } catch { channelId = "unknown"; }
      }

      const [existing] = await db
        .select({ id: ytTranscripts.id })
        .from(ytTranscripts)
        .where(eq(ytTranscripts.videoId, input.videoId))
        .limit(1);

      if (existing) {
        await db
          .update(ytTranscripts)
          .set({
            rawText: input.rawText,
            wordCount,
            lang: input.lang,
            status: "fetched",
            provider: "manual",
            fetchedAt: new Date(),
            videoTitle: input.videoTitle ?? null,
            errorMessage: null,
          })
          .where(eq(ytTranscripts.videoId, input.videoId));
      } else {
        await db.insert(ytTranscripts).values({
          videoId: input.videoId,
          channelId: channelId ?? "unknown",
          videoTitle: input.videoTitle ?? null,
          publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
          rawText: input.rawText,
          wordCount,
          lang: input.lang,
          status: "fetched",
          provider: "manual",
        });
      }

      return { success: true, videoId: input.videoId, wordCount };
    }),

  // ─── Library stats ────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, fetched: 0, noTranscript: 0, pending: 0, errors: 0, totalWords: 0 };

    const rows = await db
      .select({
        status: ytTranscripts.status,
        count: sql<number>`COUNT(*)`,
        words: sql<number>`SUM(word_count)`,
      })
      .from(ytTranscripts)
      .groupBy(ytTranscripts.status);

    const stats = { total: 0, fetched: 0, noTranscript: 0, pending: 0, errors: 0, totalWords: 0 };
    for (const row of rows) {
      const count = Number(row.count);
      const words = Number(row.words ?? 0);
      stats.total += count;
      stats.totalWords += words;
      if (row.status === "fetched") { stats.fetched = count; }
      else if (row.status === "no_transcript") { stats.noTranscript = count; }
      else if (row.status === "pending") { stats.pending = count; }
      else if (row.status === "error") { stats.errors = count; }
    }

    return stats;
  }),

  // ─── Delete transcript ────────────────────────────────────────────────────────
  deleteTranscript: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(ytTranscripts).where(eq(ytTranscripts.videoId, input.videoId));
      return { success: true };
    }),
});
