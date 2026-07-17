/**
 * Performance Loop Router — Phase F
 *
 * Closes the feedback loop: record 90-day performance metrics for published scripts,
 * compute outlier scores, and propagate weight updates back to the content_patterns table.
 *
 * How it works:
 * 1. User (or cron) submits performance data for a script at 90 days
 * 2. Compute outlier score from CTR + retention z-scores against 90-day channel baseline
 * 3. Update the script's outlier_score in script_performance_feedback
 * 4. For each pattern used in the script, update effectiveness_score as a weighted average:
 *    new_eff = 0.7 * old_eff + 0.3 * normalized_outlier_score
 * 5. If the script is an outlier (score >= 1.5), auto-seed its transcript/content into corpus
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  contentPatterns,
  scriptFactoryOutputs,
  scriptPerformanceFeedback,
  ytVideoSnapshots,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Outlier threshold: scripts scoring >= this are considered outliers */
export const OUTLIER_THRESHOLD = 1.5;

/** Pattern weight update: exponential moving average */
export const PATTERN_WEIGHT_ALPHA = 0.3; // 30% new, 70% old

/** Normalize outlier score to [0, 1] for effectiveness */
export function normalizeOutlierScore(score: number): number {
  return Math.min(1.0, score / 3.0);
}

/** Compute weighted average for pattern effectiveness update */
export function updateEffectiveness(oldEff: number, newSignal: number): number {
  return PATTERN_WEIGHT_ALPHA * newSignal + (1 - PATTERN_WEIGHT_ALPHA) * oldEff;
}

/** Compute outlier score from CTR and retention z-scores */
export function computeOutlierScore(
  ctrPct: number | null,
  retentionPct: number | null,
  baseline: { ctrMean: number; ctrStd: number; retentionMean: number; retentionStd: number }
): number {
  const scores: number[] = [];

  if (ctrPct != null && baseline.ctrStd > 0) {
    const z = Math.abs((ctrPct - baseline.ctrMean) / baseline.ctrStd);
    scores.push(z);
  }

  if (retentionPct != null && baseline.retentionStd > 0) {
    const z = Math.abs((retentionPct - baseline.retentionMean) / baseline.retentionStd);
    scores.push(z);
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const performanceLoopRouter = router({

  // ─── Submit 90-day feedback ───────────────────────────────────────────────
  submitFeedback: protectedProcedure
    .input(z.object({
      scriptId: z.number(),
      videoId: z.string().max(50).optional(),
      feedbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      ctrPct: z.number().min(0).max(100).optional(),
      avgViewDurationPct: z.number().min(0).max(100).optional(),
      views: z.number().min(0).optional(),
      likes: z.number().min(0).optional(),
      comments: z.number().min(0).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // 1. Get channel baseline (90-day rolling)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

      const [baselineRow] = await db
        .select({
          ctrMean: sql<number>`AVG(ctr_percentage)`,
          ctrStd: sql<number>`STDDEV(ctr_percentage)`,
          retentionMean: sql<number>`AVG(average_view_percentage)`,
          retentionStd: sql<number>`STDDEV(average_view_percentage)`,
        })
        .from(ytVideoSnapshots)
        .where(
          and(
            gte(ytVideoSnapshots.snapshotDate, ninetyDaysAgoStr as any),
            sql`ctr_percentage IS NOT NULL`,
            sql`average_view_percentage IS NOT NULL`
          )
        );

      const baseline = {
        ctrMean: Number(baselineRow?.ctrMean ?? 4.0),
        ctrStd: Number(baselineRow?.ctrStd ?? 1.5),
        retentionMean: Number(baselineRow?.retentionMean ?? 40.0),
        retentionStd: Number(baselineRow?.retentionStd ?? 10.0),
      };

      // 2. Compute outlier score
      const outlierScore = computeOutlierScore(
        input.ctrPct ?? null,
        input.avgViewDurationPct ?? null,
        baseline
      );

      // 3. Check for duplicate feedback on this script
      const [existingFeedback] = await db
        .select({ id: scriptPerformanceFeedback.id })
        .from(scriptPerformanceFeedback)
        .where(eq(scriptPerformanceFeedback.scriptId, input.scriptId))
        .limit(1);

      if (existingFeedback) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Feedback already submitted for this script. Delete the existing record first to resubmit.",
        });
      }

      // 4. Insert feedback record
      await db.insert(scriptPerformanceFeedback).values({
        scriptId: input.scriptId,
        videoId: input.videoId,
        feedbackDate: input.feedbackDate as any,
        ctrPct: input.ctrPct,
        avgViewDurationPct: input.avgViewDurationPct,
        views: input.views,
        likes: input.likes,
        comments: input.comments,
        outlierScore,
        notes: input.notes,
      });

      // 4. Update pattern effectiveness scores
      const [scriptRow] = await db
        .select({ verifiedPatternIds: scriptFactoryOutputs.verifiedPatternIds })
        .from(scriptFactoryOutputs)
        .where(eq(scriptFactoryOutputs.id, input.scriptId))
        .limit(1);

      const patternIds: number[] = (scriptRow?.verifiedPatternIds as number[]) ?? [];
      const normalizedScore = normalizeOutlierScore(outlierScore);
      let patternsUpdated = 0;

      for (const patternId of patternIds) {
        const [pattern] = await db
          .select({ effectivenessScore: contentPatterns.effectivenessScore })
          .from(contentPatterns)
          .where(eq(contentPatterns.id, patternId))
          .limit(1);

        if (!pattern) continue;

        const oldEff = Number(pattern.effectivenessScore ?? 0.5);
        const newEff = updateEffectiveness(oldEff, normalizedScore);

        await db
          .update(contentPatterns)
          .set({ effectivenessScore: newEff })
          .where(eq(contentPatterns.id, patternId));

        patternsUpdated++;
      }

      // 5. Mark script as approved if it's an outlier
      if (outlierScore >= OUTLIER_THRESHOLD) {
        await db
          .update(scriptFactoryOutputs)
          .set({ status: "approved" })
          .where(eq(scriptFactoryOutputs.id, input.scriptId));
      }

      return {
        ok: true,
        outlierScore: Math.round(outlierScore * 100) / 100,
        isOutlier: outlierScore >= OUTLIER_THRESHOLD,
        patternsUpdated,
        normalizedScore: Math.round(normalizedScore * 100) / 100,
      };
    }),

  // ─── List feedback records ────────────────────────────────────────────────
  listFeedback: protectedProcedure
    .input(z.object({
      scriptId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.scriptId) conditions.push(eq(scriptPerformanceFeedback.scriptId, input.scriptId));

      return db
        .select()
        .from(scriptPerformanceFeedback)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(scriptPerformanceFeedback.feedbackDate))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ─── Get performance stats ────────────────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, outliers: 0, avgOutlierScore: 0, patternsWithFeedback: 0 };

    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        outliers: sql<number>`SUM(CASE WHEN outlier_score >= ${OUTLIER_THRESHOLD} THEN 1 ELSE 0 END)`,
        avgOutlierScore: sql<number>`AVG(outlier_score)`,
      })
      .from(scriptPerformanceFeedback);

    return {
      total: Number(stats?.total ?? 0),
      outliers: Number(stats?.outliers ?? 0),
      avgOutlierScore: Number(stats?.avgOutlierScore ?? 0),
      threshold: OUTLIER_THRESHOLD,
    };
  }),

  // ─── Get scripts pending 90-day feedback ─────────────────────────────────
  getPendingFeedback: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // Scripts approved 90+ days ago that don't have feedback yet.
    // The 90-day clock starts from when the script was approved (status changed to 'approved'),
    // not from when it was created. We use updatedAt as a proxy for approvedAt since
    // status updates set updatedAt. Scripts with status='approved' AND updatedAt >= 90 days ago
    // are ready for feedback.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Get all script IDs that already have feedback
    const withFeedback = await db
      .select({ scriptId: scriptPerformanceFeedback.scriptId })
      .from(scriptPerformanceFeedback);
    const withFeedbackIds = new Set(withFeedback.map((r) => r.scriptId));

    // Get approved scripts whose updatedAt (approval time) is 90+ days ago
    const scripts = await db
      .select({
        id: scriptFactoryOutputs.id,
        title: scriptFactoryOutputs.title,
        format: scriptFactoryOutputs.format,
        createdAt: scriptFactoryOutputs.createdAt,
        updatedAt: scriptFactoryOutputs.updatedAt,
      })
      .from(scriptFactoryOutputs)
      .where(
        and(
          eq(scriptFactoryOutputs.status, "approved"),
          sql`updated_at <= ${ninetyDaysAgo.toISOString()}`
        )
      )
      .orderBy(desc(scriptFactoryOutputs.updatedAt))
      .limit(20);

    return scripts.filter((s) => !withFeedbackIds.has(s.id));
  }),

  // ─── Delete feedback record ───────────────────────────────────────────────
  deleteFeedback: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(scriptPerformanceFeedback).where(eq(scriptPerformanceFeedback.id, input.id));
      return { ok: true };
    }),
});
