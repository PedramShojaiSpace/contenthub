/**
 * Organic Signal Engine
 *
 * Monitors YouTube engagement on videos produced via the video pipeline.
 * Runs on a schedule (every 6 hours) to:
 *   1. Take engagement snapshots at 24h, 48h, 72h, 7d, and 14d post-publish
 *   2. Score each video on engagement rate, view velocity, and outlier score
 *   3. Flag strong performers as paid promotion candidates
 *
 * Thresholds for flagging:
 *   - "strong":      engagement rate ≥ 3% OR view velocity ≥ 200/day OR outlier score ≥ 1.5
 *   - "exceptional": engagement rate ≥ 6% OR view velocity ≥ 500/day OR outlier score ≥ 3.0
 */

import { getDb } from "./db";
import {
  videoJobs,
  videoEngagementSnapshots,
  paidPromoCandidates,
} from "../drizzle/schema";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { getYTClient } from "./youtubeRouter";

// Snapshot checkpoints in hours after publish
const SNAPSHOT_HOURS = [24, 48, 72, 168, 336] as const;

// Engagement thresholds
const THRESHOLDS = {
  strong: { engagementRate: 3.0, viewVelocity: 200, outlierScore: 1.5 },
  exceptional: { engagementRate: 6.0, viewVelocity: 500, outlierScore: 3.0 },
};

// Minimum views before we bother scoring (avoids false positives on tiny audiences)
const MIN_VIEWS_TO_SCORE = 50;

/**
 * Compute engagement rate: (likes + comments) / views * 100
 */
function computeEngagementRate(views: number, likes: number, comments: number): number {
  if (views === 0) return 0;
  return Math.round(((likes + comments) / views) * 10000) / 100; // 2 decimal places
}

/**
 * Compute view velocity: views per day since publish
 */
function computeViewVelocity(views: number, publishedAtMs: number): number {
  const daysSince = Math.max(1, (Date.now() - publishedAtMs) / 86400000);
  return Math.round(views / daysSince);
}

/**
 * Compute outlier score: video views / channel average views per video
 * Requires channel stats from YouTube API.
 */
function computeOutlierScore(
  videoViews: number,
  channelTotalViews: number,
  channelVideoCount: number
): number {
  if (channelVideoCount === 0 || channelTotalViews === 0) return 0;
  const avg = channelTotalViews / channelVideoCount;
  return Math.round((videoViews / avg) * 100) / 100;
}

/**
 * Determine signal strength based on engagement metrics.
 * Returns null if the video doesn't meet the minimum threshold.
 */
function classifySignalStrength(
  engagementRate: number,
  viewVelocity: number,
  outlierScore: number
): "strong" | "exceptional" | null {
  if (
    engagementRate >= THRESHOLDS.exceptional.engagementRate ||
    viewVelocity >= THRESHOLDS.exceptional.viewVelocity ||
    outlierScore >= THRESHOLDS.exceptional.outlierScore
  ) {
    return "exceptional";
  }
  if (
    engagementRate >= THRESHOLDS.strong.engagementRate ||
    viewVelocity >= THRESHOLDS.strong.viewVelocity ||
    outlierScore >= THRESHOLDS.strong.outlierScore
  ) {
    return "strong";
  }
  return null;
}

/**
 * Main poller — runs on a schedule.
 * Fetches YouTube stats for all published videos and processes snapshots.
 */
export async function runOrganicSignalPoller(): Promise<{
  videosChecked: number;
  snapshotsTaken: number;
  candidatesFlagged: number;
}> {
  const db = await getDb();
  if (!db) return { videosChecked: 0, snapshotsTaken: 0, candidatesFlagged: 0 };
  let snapshotsTaken = 0;
  let candidatesFlagged = 0;

  // 1. Get all video jobs that have been published to YouTube
  const publishedJobs = await db
    .select({
      id: videoJobs.id,
      youtubeVideoId: videoJobs.youtubeVideoId,
      youtubeTitle: videoJobs.youtubeTitle,
      youtubeThumbnailUrl: videoJobs.youtubeThumbnailUrl,
      publishedAt: videoJobs.publishedAt,
    })
    .from(videoJobs)
    .where(
      and(
        isNotNull(videoJobs.youtubeVideoId),
        isNotNull(videoJobs.publishedAt),
        eq(videoJobs.status, "published")
      )
    );

  if (publishedJobs.length === 0) {
    return { videosChecked: 0, snapshotsTaken: 0, candidatesFlagged: 0 };
  }

  // 2. Get YouTube stats for all published videos
  const videoIds = publishedJobs
    .map((j) => j.youtubeVideoId)
    .filter(Boolean) as string[];

  const yt = await getYTClient();

  // Get channel stats for outlier score computation
  let channelTotalViews = 0;
  let channelVideoCount = 0;
  try {
    const channelRes = await yt.channels.list({
      part: ["statistics"],
      mine: true,
    });
    const channelStats = channelRes.data.items?.[0]?.statistics;
    channelTotalViews = parseInt(channelStats?.viewCount ?? "0", 10);
    channelVideoCount = parseInt(channelStats?.videoCount ?? "0", 10);
  } catch (err) {
    console.warn("[OrganicSignal] Could not fetch channel stats:", err);
  }

  // Fetch video stats in batches of 50
  const videoStatsMap = new Map<string, {
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
    title: string;
    thumbnail: string;
  }>();

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    try {
      const res = await yt.videos.list({
        part: ["snippet", "statistics"],
        id: chunk,
      });
      for (const item of res.data.items ?? []) {
        if (!item.id) continue;
        videoStatsMap.set(item.id, {
          viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
          likeCount: parseInt(item.statistics?.likeCount ?? "0", 10),
          commentCount: parseInt(item.statistics?.commentCount ?? "0", 10),
          publishedAt: item.snippet?.publishedAt ?? "",
          title: item.snippet?.title ?? "",
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            "",
        });
      }
    } catch (err) {
      console.error("[OrganicSignal] Failed to fetch video stats batch:", err);
    }
  }

  // 3. Process each published job
  for (const job of publishedJobs) {
    if (!job.youtubeVideoId || !job.publishedAt) continue;

    const stats = videoStatsMap.get(job.youtubeVideoId);
    if (!stats) continue;

    const publishedAtMs = job.publishedAt;
    const hoursSincePublish = (Date.now() - publishedAtMs) / 3600000;

    // Determine which snapshot checkpoints are due
    for (const snapshotHour of SNAPSHOT_HOURS) {
      // Only take snapshot if we're past the checkpoint
      if (hoursSincePublish < snapshotHour) continue;

      // Check if we already have this snapshot
      const existing = await db
        .select({ id: videoEngagementSnapshots.id })
        .from(videoEngagementSnapshots)
        .where(
          and(
            eq(videoEngagementSnapshots.videoJobId, job.id),
            eq(videoEngagementSnapshots.snapshotHour, snapshotHour)
          )
        )
        .limit(1);

      if (existing.length > 0) continue; // Already captured

      // Compute metrics
      const viewVelocity = computeViewVelocity(stats.viewCount, publishedAtMs);
      const engagementRate = computeEngagementRate(
        stats.viewCount,
        stats.likeCount,
        stats.commentCount
      );
      const outlierScore = computeOutlierScore(
        stats.viewCount,
        channelTotalViews,
        channelVideoCount
      );

      // Save snapshot
      await db.insert(videoEngagementSnapshots).values({
        videoJobId: job.id,
        youtubeVideoId: job.youtubeVideoId,
        snapshotHour,
        viewCount: stats.viewCount,
        likeCount: stats.likeCount,
        commentCount: stats.commentCount,
        viewVelocity,
        engagementRate: engagementRate.toFixed(2),
        outlierScore: outlierScore.toFixed(2),
      });
      snapshotsTaken++;

      // 4. Check if this video qualifies as a paid promo candidate
      // Only evaluate at the 72h snapshot (enough data, not too late)
      if (snapshotHour === 72 && stats.viewCount >= MIN_VIEWS_TO_SCORE) {
        const signalStrength = classifySignalStrength(
          engagementRate,
          viewVelocity,
          outlierScore
        );

        if (signalStrength) {
          // Check if already flagged
          const alreadyFlagged = await db
            .select({ id: paidPromoCandidates.id })
            .from(paidPromoCandidates)
            .where(eq(paidPromoCandidates.videoJobId, job.id))
            .limit(1);

          if (alreadyFlagged.length === 0) {
            await db.insert(paidPromoCandidates).values({
              videoJobId: job.id,
              youtubeVideoId: job.youtubeVideoId,
              youtubeTitle: job.youtubeTitle ?? stats.title,
              youtubeThumbnailUrl: job.youtubeThumbnailUrl ?? stats.thumbnail,
              viewCount: stats.viewCount,
              likeCount: stats.likeCount,
              commentCount: stats.commentCount,
              viewVelocity,
              engagementRate: engagementRate.toFixed(2),
              outlierScore: outlierScore.toFixed(2),
              signalStrength,
              status: "flagged",
            });
            candidatesFlagged++;
            console.log(
              `[OrganicSignal] Flagged "${job.youtubeTitle}" as ${signalStrength} candidate ` +
              `(ER: ${engagementRate.toFixed(1)}%, vel: ${viewVelocity}/day, outlier: ${outlierScore.toFixed(1)}x)`
            );
          }
        }
      }
    }
  }

  return {
    videosChecked: publishedJobs.length,
    snapshotsTaken,
    candidatesFlagged,
  };
}

/**
 * Get all paid promo candidates with their latest engagement data.
 */
export async function getPaidPromoCandidates(statusFilter?: string[]) {
  const db = await getDb();
  if (!db) return [];
  const conditions = statusFilter && statusFilter.length > 0
    ? [inArray(paidPromoCandidates.status, statusFilter as any[])]
    : [];

  const candidates = await db
    .select()
    .from(paidPromoCandidates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${paidPromoCandidates.flaggedAt} DESC`);

  return candidates.map((c) => ({
    ...c,
    claudeRecommendation: c.claudeRecommendation
      ? JSON.parse(c.claudeRecommendation)
      : null,
  }));
}

/**
 * Update a paid promo candidate's status.
 */
export async function updateCandidateStatus(
  candidateId: number,
  status: "flagged" | "recommended" | "approved" | "launched" | "dismissed",
  extra?: {
    claudeRecommendation?: object;
    metaCampaignId?: string;
    metaAdSetId?: string;
    metaAdId?: string;
    launchedBy?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(paidPromoCandidates)
    .set({
      status,
      ...(extra?.claudeRecommendation
        ? {
            claudeRecommendation: JSON.stringify(extra.claudeRecommendation),
            recommendationGeneratedAt: new Date(),
          }
        : {}),
      ...(extra?.metaCampaignId ? { metaCampaignId: extra.metaCampaignId } : {}),
      ...(extra?.metaAdSetId ? { metaAdSetId: extra.metaAdSetId } : {}),
      ...(extra?.metaAdId ? { metaAdId: extra.metaAdId } : {}),
      ...(extra?.launchedBy ? { launchedBy: extra.launchedBy, launchedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(paidPromoCandidates.id, candidateId));
}
