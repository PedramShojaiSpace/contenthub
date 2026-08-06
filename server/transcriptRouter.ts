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
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
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

// ─── Shared quota-ledgered transcript acquisition ────────────────────────────

/**
 * The outcome of one transcript acquisition attempt.
 *
 * `cached`        — already in `yt_transcripts` as `fetched`; ZERO API cost.
 * `fetched`       — newly retrieved from Supadata; one ledger unit consumed.
 * `quota_blocked` — the daily cap was already reached; nothing was fetched.
 * `no_transcript` — the video genuinely has no transcript; NO ledger charge.
 * `error`         — API/network failure; charged against the ledger.
 */
export type TranscriptFetchOutcome =
  | "cached"
  | "fetched"
  | "quota_blocked"
  | "no_transcript"
  | "error";

export interface TranscriptFetchResult {
  videoId: string;
  outcome: TranscriptFetchOutcome;
  /** Full transcript text when available (cached or freshly fetched). */
  text: string | null;
  wordCount: number | null;
  lang: string | null;
  error: string | null;
}

/**
 * Acquire one YouTube transcript, respecting the Supadata daily ledger.
 *
 * This is THE single entry point for transcript acquisition. Both the
 * `fetchTranscript` procedure and the Script Factory's deep-research pipeline
 * call it, which guarantees the 25/day cap can never be bypassed and that a
 * transcript already in `yt_transcripts` is never re-fetched.
 *
 * Order of operations:
 *   1. Cache check   — return immediately if already `fetched` (no quota spend).
 *   2. Quota check   — return `quota_blocked` if nothing remains (never throws,
 *                      so batch callers can degrade to a partial result).
 *   3. Fetch         — call Supadata, persist FULL raw text, increment ledger.
 *
 * Unlike the tRPC procedure this never throws on quota exhaustion; callers that
 * want an error (like `fetchTranscript`) translate the outcome themselves.
 */
export async function fetchTranscriptWithQuota(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: {
    videoId: string;
    videoTitle?: string | null;
    channelId?: string | null;
    publishedAt?: string | Date | null;
  }
): Promise<TranscriptFetchResult> {
  const base = { videoId: input.videoId, text: null, wordCount: null, lang: null, error: null };

  // ── 1. Cache check — a transcript we already own costs nothing ──────────────
  const [existing] = await db
    .select({
      id: ytTranscripts.id,
      status: ytTranscripts.status,
      rawText: ytTranscripts.rawText,
      wordCount: ytTranscripts.wordCount,
      lang: ytTranscripts.lang,
    })
    .from(ytTranscripts)
    .where(eq(ytTranscripts.videoId, input.videoId))
    .limit(1);

  if (existing?.status === "fetched") {
    return {
      ...base,
      outcome: "cached",
      text: existing.rawText ?? null,
      wordCount: existing.wordCount ?? null,
      lang: existing.lang ?? null,
    };
  }

  // ── 2. Quota check — degrade gracefully rather than throwing ────────────────
  const quota = await getOrCreateQuota(db);
  if (quota.remaining <= 0) {
    return {
      ...base,
      outcome: "quota_blocked",
      error: `Daily Supadata quota exhausted (${quota.unitsUsed}/${quota.dailyLimit}). Resets tomorrow.`,
    };
  }

  // Resolve a channel id — the column is NOT NULL, so fall back to "unknown".
  let channelId = input.channelId ?? undefined;
  if (!channelId) {
    try {
      channelId = await getOwnerChannelId();
    } catch {
      channelId = "unknown";
    }
  }

  const publishedAt = input.publishedAt
    ? (input.publishedAt instanceof Date ? input.publishedAt : new Date(input.publishedAt))
    : null;

  if (!existing) {
    await db.insert(ytTranscripts).values({
      videoId: input.videoId,
      channelId,
      videoTitle: input.videoTitle ?? null,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      status: "pending",
      provider: "supadata",
    });
  }

  // ── 3. Fetch and persist the FULL text (no truncation) ─────────────────────
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
        // Backfill the title if we learned it from the caller this time.
        ...(input.videoTitle ? { videoTitle: input.videoTitle } : {}),
      })
      .where(eq(ytTranscripts.videoId, input.videoId));

    await incrementQuota(db);

    return { ...base, outcome: "fetched", text, wordCount, lang };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const isMissing = msg === "NO_TRANSCRIPT";

    await db
      .update(ytTranscripts)
      .set({
        status: isMissing ? "no_transcript" : "error",
        errorMessage: isMissing ? null : msg,
      })
      .where(eq(ytTranscripts.videoId, input.videoId));

    // A missing transcript isn't an API failure, so it isn't charged.
    if (!isMissing) await incrementQuota(db);

    return {
      ...base,
      outcome: isMissing ? "no_transcript" : "error",
      error: msg,
    };
  }
}

/** Exposed so batch callers can pre-flight the ledger before looping. */
export async function getTranscriptQuota(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
) {
  return getOrCreateQuota(db);
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

      // All acquisition logic (cache → quota → fetch → persist → ledger) lives in
      // the shared helper so it cannot drift between callers.
      const result = await fetchTranscriptWithQuota(db, {
        videoId: input.videoId,
        videoTitle: input.videoTitle ?? null,
        channelId: input.channelId ?? null,
        publishedAt: input.publishedAt ?? null,
      });

      // This procedure's original contract surfaced quota exhaustion as an error.
      if (result.outcome === "quota_blocked") {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: result.error ?? "Daily quota exhausted. Resets tomorrow.",
        });
      }

      if (result.outcome === "cached") {
        return { success: true, status: "already_fetched", videoId: input.videoId };
      }

      if (result.outcome === "fetched") {
        return {
          success: true,
          status: "fetched",
          videoId: input.videoId,
          wordCount: result.wordCount ?? undefined,
          lang: result.lang ?? undefined,
        };
      }

      return {
        success: false,
        status: result.outcome,
        videoId: input.videoId,
        error: result.error ?? "Unknown error",
      };
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
      const videoIds = videos.map((v) => v.videoId);
      const existingRows = videoIds.length > 0
        ? await db
            .select({ videoId: ytTranscripts.videoId, status: ytTranscripts.status })
            .from(ytTranscripts)
            .where(inArray(ytTranscripts.videoId, videoIds))
        : [];

      const existingMap = new Map(existingRows.map((r) => [r.videoId, r.status]));
      const toFetch = videos
        .filter((v) => {
          const s = existingMap.get(v.videoId);
          return !s || s === "pending" || s === "error"; // retry errors
        })
        .slice(0, limit);

      // nextPageToken from the first item (all items share the same token per page)
      const pageNextToken = videos.find((v) => v.nextPageToken)?.nextPageToken ?? null;

      if (toFetch.length === 0) {
        return {
          fetched: 0,
          noTranscript: 0,
          errors: 0,
          skipped: videos.length,
          quotaUsed: 0,
          quotaRemaining: quota.remaining,
          nextPageToken: pageNextToken,
          message: pageNextToken
            ? "All videos on this page already processed — click again to advance to the next page"
            : "All videos already processed",
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
        nextPageToken: pageNextToken,
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
