/**
 * Video Pipeline tRPC Router
 *
 * Procedures:
 *  - startVideoJob: enqueue a new video job from a published script
 *  - getVideoJobs: list all video jobs with status
 *  - approveVideoJob: VA approves → triggers YouTube upload
 *  - rejectVideoJob: VA rejects → marks as failed with reason
 *  - retryVideoJob: reset failed job back to queued
 *  - updateVideoMetadata: VA edits title/description/tags before publishing
 *  - processScheduledVideoJobs: cron endpoint (public)
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { processScheduledVideoJobs } from "./descriptPipeline";
import { uploadToYouTube } from "./youtubeUploader";

export const videoPipelineRouter = router({
  // ── Enqueue a new video job ─────────────────────────────────────────────────
  startVideoJob: protectedProcedure
    .input(
      z.object({
        contentItemId: z.number(),
        scriptTitle: z.string().min(1).max(512),
        scriptText: z.string().min(1),
        topic: z.string().optional(),
        keywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");

      const [result] = await db.insert(videoJobs).values({
        contentItemId: input.contentItemId,
        scriptTitle: input.scriptTitle,
        scriptText: input.scriptText,
        youtubeTags: input.keywords ? JSON.stringify(input.keywords) : null,
        status: "queued",
      });

      return {
        success: true,
        jobId: (result as any).insertId as number,
        message: "Video job queued. The pipeline will process it within 15 minutes.",
      };
    }),

  // ── List all video jobs ─────────────────────────────────────────────────────
  getVideoJobs: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "queued",
            "importing",
            "processing",
            "rendering",
            "ready_for_review",
            "approved",
            "publishing",
            "published",
            "failed",
            "skipped",
          ])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");
      const query = db
        .select()
        .from(videoJobs)
        .orderBy(desc(videoJobs.createdAt))
        .limit(input.limit);

      if (input.status) {
        return query.where(eq(videoJobs.status, input.status));
      }
      return query;
    }),

  // ── Update YouTube metadata (VA edits before publish) ──────────────────────
  updateVideoMetadata: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        youtubeTitle: z.string().min(1).max(100).optional(),
        youtubeDescription: z.string().optional(),
        youtubeTags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");
      await db
        .update(videoJobs)
        .set({
          ...(input.youtubeTitle ? { youtubeTitle: input.youtubeTitle } : {}),
          ...(input.youtubeDescription
            ? { youtubeDescription: input.youtubeDescription }
            : {}),
          ...(input.youtubeTags
            ? { youtubeTags: JSON.stringify(input.youtubeTags) }
            : {}),
        })
        .where(eq(videoJobs.id, input.jobId));
      return { success: true };
    }),

  // ── VA approves → upload to YouTube ────────────────────────────────────────
  approveVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");

      const jobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, input.jobId))
        .limit(1);

      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];

      if (job.status !== "ready_for_review") {
        throw new Error(
          `Job is in status '${job.status}', expected 'ready_for_review'`
        );
      }

      if (!job.videoS3Url) {
        throw new Error("Video S3 URL is missing — cannot upload to YouTube");
      }

      // Mark as approved
      await db
        .update(videoJobs)
        .set({ status: "approved", vaApprovedAt: Date.now() })
        .where(eq(videoJobs.id, input.jobId));

      // Mark as publishing
      await db
        .update(videoJobs)
        .set({ status: "publishing" })
        .where(eq(videoJobs.id, input.jobId));

      try {
        const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
        const uploadResult = await uploadToYouTube({
          videoUrl: job.videoS3Url,
          title: job.youtubeTitle ?? job.scriptTitle,
          description: job.youtubeDescription ?? "",
          tags,
          privacyStatus: "public",
        });

        await db
          .update(videoJobs)
          .set({
            status: "published",
            youtubeVideoId: uploadResult.videoId,
            youtubeVideoUrl: uploadResult.videoUrl,
            publishedAt: Date.now(),
          })
          .where(eq(videoJobs.id, input.jobId));

        return {
          success: true,
          youtubeVideoId: uploadResult.videoId,
          youtubeVideoUrl: uploadResult.videoUrl,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(videoJobs)
          .set({ status: "failed", errorMessage: message })
          .where(eq(videoJobs.id, input.jobId));
        throw err;
      }
    }),

  // ── VA rejects video ────────────────────────────────────────────────────────
  rejectVideoJob: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");
      await db
        .update(videoJobs)
        .set({
          status: "failed",
          errorMessage: input.reason ?? "Rejected by VA",
        })
        .where(eq(videoJobs.id, input.jobId));
      return { success: true };
    }),

  // ── Retry a failed job ──────────────────────────────────────────────────────
  retryVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new Error("Database unavailable");
      if (!db) throw new Error("Database unavailable");

      const jobs = await db
        .select({ status: videoJobs.status, retryCount: videoJobs.retryCount })
        .from(videoJobs)
        .where(eq(videoJobs.id, input.jobId))
        .limit(1);

      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);

      await db
        .update(videoJobs)
        .set({
          status: "queued",
          errorMessage: null,
          retryCount: (jobs[0].retryCount ?? 0) + 1,
        })
        .where(eq(videoJobs.id, input.jobId));

      return { success: true };
    }),

  // ── Cron: process scheduled video jobs (public — verified by INGEST_SECRET) ─
  processScheduledVideoJobs: publicProcedure.mutation(async () => {
    const result = await processScheduledVideoJobs();
    return result;
  }),
});
