/**
 * Outlier Detector Router — Phase B
 *
 * Scores each YouTube video against the channel's rolling 90-day baseline.
 * Outlier = video whose CTR or retention z-score exceeds the threshold (default: 1.5σ).
 *
 * Data source:
 *   - YouTube Analytics API (CTR, avg view duration, views, impressions)
 *   - yt_video_snapshots (already populated by ytAnalyticsRouter)
 *   - yt_video_outliers (written by this router)
 *
 * Algorithm:
 *   1. computeBaseline: pull all scored videos from last 90 days → mean & stddev for CTR and retention
 *   2. scoreVideo: compute z-scores for CTR and retention vs baseline
 *   3. outlierScore = (|ctr_z| + |retention_z|) / 2
 *   4. isOutlier = outlierScore > OUTLIER_THRESHOLD (1.5)
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { ytVideoOutliers, ytVideoSnapshots } from "../drizzle/schema";
// Note: ytVideoSnapshots uses `title` (not videoTitle), `thumbnailCtr` (not ctr),
// `avgViewDurationSec` (not avgViewDuration), and no `videoDuration` column.
// Retention is computed from avgViewPct (averageViewPercentage / 100).
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTLIER_THRESHOLD = 1.5; // z-score threshold to flag as outlier
const BASELINE_DAYS = 90;      // rolling window for baseline computation

// ─── Math helpers ─────────────────────────────────────────────────────────────

/**
 * Compute mean and population standard deviation of a numeric array.
 * Returns { mean, stddev } — stddev is 0 if array has < 2 elements.
 */
export function computeStats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return { mean, stddev: 0 };
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * Compute z-score: (value - mean) / stddev.
 * Returns 0 if stddev is 0 (all values identical).
 */
export function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return (value - mean) / stddev;
}

/**
 * Compute composite outlier score from CTR and retention z-scores.
 * Uses the average of absolute z-scores so both dimensions contribute equally.
 */
export function computeOutlierScore(ctrZ: number, retentionZ: number): number {
  return (Math.abs(ctrZ) + Math.abs(retentionZ)) / 2;
}

/**
 * Compute retention score from avg view duration and video duration.
 * Returns null if either is 0 or missing.
 */
export function computeRetentionScore(
  avgViewDurationSec: number,
  videoDurationSec: number
): number | null {
  if (!videoDurationSec || videoDurationSec === 0) return null;
  if (!avgViewDurationSec || avgViewDurationSec === 0) return null;
  return Math.min(avgViewDurationSec / videoDurationSec, 1.0);
}

// ─── Baseline computation ─────────────────────────────────────────────────────

interface ChannelBaseline {
  ctrMean: number;
  ctrStddev: number;
  retentionMean: number;
  retentionStddev: number;
  sampleSize: number;
  windowDays: number;
}

/**
 * Compute the channel's rolling baseline from yt_video_snapshots.
 * Uses the most recent snapshot per video within the last BASELINE_DAYS days.
 */
async function computeChannelBaseline(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  windowDays = BASELINE_DAYS
): Promise<ChannelBaseline> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Pull most-recent snapshot per video within the window
  const snapshots = await db
    .select({
      videoId: ytVideoSnapshots.videoId,
      thumbnailCtr: ytVideoSnapshots.thumbnailCtr,
      avgViewPct: ytVideoSnapshots.avgViewPct,
      avgViewDurationSec: ytVideoSnapshots.avgViewDurationSec,
    })
    .from(ytVideoSnapshots)
    .where(
      and(
        gte(ytVideoSnapshots.snapshotDate, cutoff.toISOString().slice(0, 10)),
        isNotNull(ytVideoSnapshots.thumbnailCtr)
      )
    )
    .orderBy(desc(ytVideoSnapshots.snapshotDate));

  // Deduplicate: keep most recent per videoId
  const seen = new Set<string>();
  const deduped = snapshots.filter((s) => {
    if (seen.has(s.videoId)) return false;
    seen.add(s.videoId);
    return true;
  });

  const ctrs: number[] = [];
  const retentions: number[] = [];

  for (const snap of deduped) {
    // thumbnailCtr is stored as percentage (e.g. 4.5 = 4.5%), normalize to 0-1
    if (snap.thumbnailCtr !== null && snap.thumbnailCtr !== undefined) {
      ctrs.push(Number(snap.thumbnailCtr) / 100);
    }
    // avgViewPct is stored as percentage (e.g. 45.2 = 45.2%), normalize to 0-1
    if (snap.avgViewPct !== null && snap.avgViewPct !== undefined) {
      retentions.push(Number(snap.avgViewPct) / 100);
    }
  }

  const ctrStats = computeStats(ctrs);
  const retentionStats = computeStats(retentions);

  return {
    ctrMean: ctrStats.mean,
    ctrStddev: ctrStats.stddev,
    retentionMean: retentionStats.mean,
    retentionStddev: retentionStats.stddev,
    sampleSize: deduped.length,
    windowDays,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const outlierRouter = router({

  // ─── Get channel baseline ─────────────────────────────────────────────────
  getBaseline: protectedProcedure
    .input(z.object({ windowDays: z.number().min(7).max(365).default(90) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      return computeChannelBaseline(db, input.windowDays);
    }),

  // ─── Score a single video ─────────────────────────────────────────────────
  scoreVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1).max(64),
        videoTitle: z.string().optional(),
        ctrScore: z.number().min(0).max(1),
        retentionScore: z.number().min(0).max(1).optional(),
        views: z.number().min(0).default(0),
        avgViewDurationSec: z.number().min(0).default(0),
        videoDurationSec: z.number().min(0).default(0),
        impressions: z.number().min(0).default(0),
        publishedAt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const baseline = await computeChannelBaseline(db);

      const retentionScore =
        input.retentionScore ??
        computeRetentionScore(input.avgViewDurationSec, input.videoDurationSec) ??
        0;

      const ctrZ = zScore(input.ctrScore, baseline.ctrMean, baseline.ctrStddev);
      const retentionZ = zScore(retentionScore, baseline.retentionMean, baseline.retentionStddev);
      const outlierScore = computeOutlierScore(ctrZ, retentionZ);
      const isOutlier = outlierScore >= OUTLIER_THRESHOLD ? 1 : 0;

      const [existing] = await db
        .select({ id: ytVideoOutliers.id })
        .from(ytVideoOutliers)
        .where(eq(ytVideoOutliers.videoId, input.videoId))
        .limit(1);

      const row = {
        videoId: input.videoId,
        videoTitle: input.videoTitle ?? null,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        ctrScore: input.ctrScore,
        retentionScore,
        views: input.views,
        avgViewDurationSec: input.avgViewDurationSec,
        videoDurationSec: input.videoDurationSec,
        impressions: input.impressions,
        outlierScore,
        ctrZScore: ctrZ,
        retentionZScore: retentionZ,
        isOutlier,
        baselineCtr: baseline.ctrMean,
        baselineRetention: baseline.retentionMean,
        baselineCtrStddev: baseline.ctrStddev,
        baselineRetentionStddev: baseline.retentionStddev,
        scoredAt: new Date(),
      };

      if (existing) {
        await db.update(ytVideoOutliers).set(row).where(eq(ytVideoOutliers.videoId, input.videoId));
      } else {
        await db.insert(ytVideoOutliers).values(row);
      }

      return { ...row, baseline };
    }),

  // ─── Score all videos from yt_video_snapshots ─────────────────────────────
  scoreAll: protectedProcedure
    .input(z.object({ windowDays: z.number().min(7).max(365).default(90) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const baseline = await computeChannelBaseline(db, input.windowDays);

      if (baseline.sampleSize === 0) {
        return { scored: 0, outliers: 0, baseline, message: "No snapshots available to score" };
      }

      // Get all unique videos from snapshots (most recent per video)
      const snapshots = await db
        .select({
          videoId: ytVideoSnapshots.videoId,
          title: ytVideoSnapshots.title,
          thumbnailCtr: ytVideoSnapshots.thumbnailCtr,
          avgViewPct: ytVideoSnapshots.avgViewPct,
          avgViewDurationSec: ytVideoSnapshots.avgViewDurationSec,
          views: ytVideoSnapshots.views,
          impressions: ytVideoSnapshots.impressions,
          publishedAt: ytVideoSnapshots.publishedAt,
        })
        .from(ytVideoSnapshots)
        .where(isNotNull(ytVideoSnapshots.thumbnailCtr))
        .orderBy(desc(ytVideoSnapshots.snapshotDate));

      // Deduplicate: keep most recent per videoId
      const seen = new Set<string>();
      const deduped = snapshots.filter((s) => {
        if (seen.has(s.videoId)) return false;
        seen.add(s.videoId);
        return true;
      });

      let scored = 0;
      let outliers = 0;

      for (const snap of deduped) {
        // thumbnailCtr stored as percentage — normalize to 0-1
        const ctrScore = Number(snap.thumbnailCtr ?? 0) / 100;
        // avgViewPct stored as percentage — normalize to 0-1
        const retentionScore = Number(snap.avgViewPct ?? 0) / 100;

        const ctrZ = zScore(ctrScore, baseline.ctrMean, baseline.ctrStddev);
        const retentionZ = zScore(retentionScore, baseline.retentionMean, baseline.retentionStddev);
        const outlierScore = computeOutlierScore(ctrZ, retentionZ);
        const isOutlier = outlierScore >= OUTLIER_THRESHOLD ? 1 : 0;

        const row = {
          videoId: snap.videoId,
          videoTitle: snap.title ?? null,
          publishedAt: snap.publishedAt ? new Date(snap.publishedAt) : null,
          ctrScore,
          retentionScore,
          views: Number(snap.views ?? 0),
          avgViewDurationSec: Number(snap.avgViewDurationSec ?? 0),
          videoDurationSec: 0, // not stored in snapshots
          impressions: Number(snap.impressions ?? 0),
          outlierScore,
          ctrZScore: ctrZ,
          retentionZScore: retentionZ,
          isOutlier,
          baselineCtr: baseline.ctrMean,
          baselineRetention: baseline.retentionMean,
          baselineCtrStddev: baseline.ctrStddev,
          baselineRetentionStddev: baseline.retentionStddev,
          scoredAt: new Date(),
        };

        const [existing] = await db
          .select({ id: ytVideoOutliers.id })
          .from(ytVideoOutliers)
          .where(eq(ytVideoOutliers.videoId, snap.videoId))
          .limit(1);

        if (existing) {
          await db.update(ytVideoOutliers).set(row).where(eq(ytVideoOutliers.videoId, snap.videoId));
        } else {
          await db.insert(ytVideoOutliers).values(row);
        }

        scored++;
        if (isOutlier) outliers++;
      }

      return { scored, outliers, baseline, message: `Scored ${scored} videos, found ${outliers} outliers` };
    }),

  // ─── List outliers ────────────────────────────────────────────────────────
  listOutliers: protectedProcedure
    .input(
      z.object({
        onlyOutliers: z.boolean().default(false),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(["outlier_score", "ctr_score", "retention_score", "views"]).default("outlier_score"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = input.onlyOutliers
        ? [eq(ytVideoOutliers.isOutlier, 1)]
        : [];

      const sortColumn = {
        outlier_score: ytVideoOutliers.outlierScore,
        ctr_score: ytVideoOutliers.ctrScore,
        retention_score: ytVideoOutliers.retentionScore,
        views: ytVideoOutliers.views,
      }[input.sortBy] ?? ytVideoOutliers.outlierScore;

      const rows = await db
        .select()
        .from(ytVideoOutliers)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sortColumn))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── Get outlier stats ────────────────────────────────────────────────────
  getOutlierStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, outliers: 0, avgOutlierScore: 0, topCtr: 0, topRetention: 0 };

    const rows = await db
      .select({
        total: sql<number>`COUNT(*)`,
        outliers: sql<number>`SUM(is_outlier)`,
        avgOutlierScore: sql<number>`AVG(outlier_score)`,
        topCtr: sql<number>`MAX(ctr_score)`,
        topRetention: sql<number>`MAX(retention_score)`,
      })
      .from(ytVideoOutliers);

    const r = rows[0];
    return {
      total: Number(r?.total ?? 0),
      outliers: Number(r?.outliers ?? 0),
      avgOutlierScore: Number(r?.avgOutlierScore ?? 0),
      topCtr: Number(r?.topCtr ?? 0),
      topRetention: Number(r?.topRetention ?? 0),
    };
  }),

  // ─── Get single video outlier record ─────────────────────────────────────
  getVideoOutlier: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(ytVideoOutliers)
        .where(eq(ytVideoOutliers.videoId, input.videoId))
        .limit(1);
      return row ?? null;
    }),
});
