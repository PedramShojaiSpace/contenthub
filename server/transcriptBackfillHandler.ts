/**
 * Transcript Backfill Scheduled Handler
 *
 * Called by the Manus Heartbeat cron daily at 08:00 UTC.
 * Fetches up to 25 transcripts from the Urban Monk YouTube channel via Supadata.
 *
 * Endpoint: POST /api/scheduled/transcript-backfill
 * Auth: Manus cron identity (user.isCron === true)
 */

import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { ytQuotaLedger, ytTranscripts } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { getYTClient } from "./youtubeRouter";

const SUPADATA_BASE = "https://api.supadata.ai/v1";
const DEFAULT_DAILY_LIMIT = 25;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateQuota(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const today = todayStr();
  const [existing] = await db
    .select()
    .from(ytQuotaLedger)
    .where(eq(ytQuotaLedger.date, today))
    .limit(1);

  if (existing) {
    return { id: existing.id, unitsUsed: existing.unitsUsed, dailyLimit: existing.dailyLimit, remaining: existing.dailyLimit - existing.unitsUsed };
  }

  await db.insert(ytQuotaLedger).values({ date: today, unitsUsed: 0, dailyLimit: DEFAULT_DAILY_LIMIT });
  const [created] = await db.select().from(ytQuotaLedger).where(eq(ytQuotaLedger.date, today)).limit(1);
  return { id: created!.id, unitsUsed: 0, dailyLimit: DEFAULT_DAILY_LIMIT, remaining: DEFAULT_DAILY_LIMIT };
}

async function incrementQuota(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  await db.update(ytQuotaLedger).set({ unitsUsed: sql`units_used + 1` }).where(eq(ytQuotaLedger.date, todayStr()));
}

async function fetchSupadataTranscript(videoId: string): Promise<{ text: string; lang: string }> {
  const apiKey = ENV.supadataApiKey;
  if (!apiKey) throw new Error("SUPADATA_API_KEY not configured");

  const url = `${SUPADATA_BASE}/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=en&text=true`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.status === 404 || (body as { error?: string }).error === "not-found") throw new Error("NO_TRANSCRIPT");
    throw new Error(`Supadata error ${res.status}: ${(body as { details?: string }).details ?? res.statusText}`);
  }

  const data = await res.json() as { lang?: string; content?: string };
  const text = data.content ?? "";
  if (!text || text.trim().length < 10) throw new Error("NO_TRANSCRIPT");
  return { text, lang: data.lang ?? "en" };
}

async function getOwnerChannelId(): Promise<string> {
  const yt = await getYTClient();
  const res = await yt.channels.list({ part: ["id"], mine: true });
  const channelId = res.data.items?.[0]?.id;
  if (!channelId) throw new Error("Could not resolve owner YouTube channel ID");
  return channelId;
}

async function getChannelVideoIds(maxResults = 50, pageToken?: string) {
  const yt = await getYTClient();
  const channelId = await getOwnerChannelId();

  const chRes = await yt.channels.list({ part: ["contentDetails"], id: [channelId] });
  const uploadsPlaylistId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Could not find uploads playlist");

  const plRes = await yt.playlistItems.list({
    part: ["contentDetails", "snippet"],
    playlistId: uploadsPlaylistId,
    maxResults,
    ...(pageToken ? { pageToken } : {}),
  });

  return {
    videos: (plRes.data.items ?? []).map((item) => ({
      videoId: item.contentDetails?.videoId ?? "",
      title: item.snippet?.title ?? "",
      publishedAt: item.contentDetails?.videoPublishedAt ?? null,
    })).filter((v) => v.videoId),
    nextPageToken: plRes.data.nextPageToken ?? null,
  };
}

export async function transcriptBackfillHandler(req: Request, res: Response) {
  try {
    // Authenticate cron caller
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const quota = await getOrCreateQuota(db);
    if (quota.remaining <= 0) {
      return res.json({
        ok: true,
        skipped: "quota_exhausted",
        unitsUsed: quota.unitsUsed,
        dailyLimit: quota.dailyLimit,
        message: `Daily quota exhausted (${quota.unitsUsed}/${quota.dailyLimit})`,
      });
    }

    // Get video IDs from YouTube Data API — paginate until we have enough unprocessed videos
    // Load existing IDs first so we can skip already-done videos while paginating
    const existingRows = await db
      .select({ videoId: ytTranscripts.videoId, status: ytTranscripts.status })
      .from(ytTranscripts);
    const existingMap = new Map(existingRows.map((r) => [r.videoId, r.status]));

    let toFetch: { videoId: string; title: string; publishedAt: string | null }[] = [];
    let pageToken: string | undefined = undefined;
    let totalScanned = 0;
    const MAX_PAGES = 10; // safety cap — scans up to 500 videos per run
    let pages = 0;

    try {
      while (toFetch.length < quota.remaining && pages < MAX_PAGES) {
        const { videos: pageVideos, nextPageToken } = await getChannelVideoIds(50, pageToken);
        totalScanned += pageVideos.length;
        for (const v of pageVideos) {
          const s = existingMap.get(v.videoId);
          if (!s || s === "pending" || s === "error") {
            toFetch.push(v);
            if (toFetch.length >= quota.remaining) break;
          }
        }
        if (!nextPageToken) break; // no more pages
        pageToken = nextPageToken;
        pages++;
      }
    } catch (err) {
      return res.status(500).json({ error: `Failed to fetch channel videos: ${err instanceof Error ? err.message : "Unknown"}` });
    }

    if (toFetch.length === 0) {
      return res.json({ ok: true, fetched: 0, noTranscript: 0, errors: 0, skipped: totalScanned, message: "All scanned videos already processed" });
    }

    let channelId = "unknown";
    try { channelId = await getOwnerChannelId(); } catch { /* ignore */ }

    let fetched = 0, noTranscript = 0, errors = 0;

    for (const video of toFetch) {
      // Upsert pending row
      const [existingRow] = await db.select({ id: ytTranscripts.id }).from(ytTranscripts).where(eq(ytTranscripts.videoId, video.videoId)).limit(1);
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
        await db.update(ytTranscripts).set({
          rawText: text, wordCount, lang, status: "fetched", fetchedAt: new Date(), videoTitle: video.title, errorMessage: null,
        }).where(eq(ytTranscripts.videoId, video.videoId));
        await incrementQuota(db);
        fetched++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg === "NO_TRANSCRIPT") {
          await db.update(ytTranscripts).set({ status: "no_transcript", videoTitle: video.title }).where(eq(ytTranscripts.videoId, video.videoId));
          noTranscript++;
        } else {
          await db.update(ytTranscripts).set({ status: "error", errorMessage: msg, videoTitle: video.title }).where(eq(ytTranscripts.videoId, video.videoId));
          await incrementQuota(db);
          errors++;
        }
      }
    }

    const finalQuota = await getOrCreateQuota(db);

    console.log(`[TranscriptBackfill] ${fetched} fetched, ${noTranscript} no transcript, ${errors} errors. Quota: ${finalQuota.unitsUsed}/${finalQuota.dailyLimit}`);

    return res.json({
      ok: true,
      fetched,
      noTranscript,
      errors,
      skipped: videos.length - toFetch.length,
      quotaUsed: finalQuota.unitsUsed,
      quotaRemaining: finalQuota.remaining,
      message: `Processed ${toFetch.length} videos: ${fetched} fetched, ${noTranscript} no transcript, ${errors} errors`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TranscriptBackfill] Error:", msg);
    return res.status(500).json({
      error: msg,
      context: { url: req.url, taskUid: (req as any).user?.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
