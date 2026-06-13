/**
 * Video Pipeline tRPC Router
 * Status enum (actual DB): pending|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
 */

import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { processScheduledVideoJobs } from "./descriptPipeline";
import { uploadToYouTube } from "./youtubeUploader";

const VIDEO_JOB_STATUSES = [
  "pending", "importing", "editing", "rendering",
  "ready_for_review", "approved", "uploading", "published", "failed", "rejected",
] as const;

export const videoPipelineRouter = router({
  startVideoJob: protectedProcedure
    .input(z.object({
      contentItemId: z.number(),
      scriptTitle: z.string().min(1).max(512),
      scriptText: z.string().min(1),
      topic: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      ctaId: z.number().optional(),
      ctaLabel: z.string().optional(),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [result] = await db.insert(videoJobs).values({
        contentItemId: input.contentItemId,
        scriptText: input.scriptText,
        youtubeTitle: input.scriptTitle.substring(0, 512),
        youtubeTags: input.keywords ? JSON.stringify(input.keywords) : null,
        ctaId: input.ctaId ?? null,
        ctaLabel: input.ctaLabel ?? null,
        ctaText: input.ctaText ?? null,
        ctaUrl: input.ctaUrl ?? null,
        status: "pending",
      });

      return {
        success: true,
        jobId: (result as any).insertId as number,
        message: "Video job queued. The pipeline will process it within 15 minutes.",
      };
    }),

  getVideoJobs: protectedProcedure
    .input(z.object({
      status: z.enum(VIDEO_JOB_STATUSES).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const query = db.select().from(videoJobs).orderBy(desc(videoJobs.createdAt)).limit(input.limit);
      if (input.status) return query.where(eq(videoJobs.status, input.status));
      return query;
    }),

  updateVideoMetadata: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      youtubeTitle: z.string().min(1).max(512).optional(),
      youtubeDescription: z.string().optional(),
      youtubeTags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(videoJobs).set({
        ...(input.youtubeTitle ? { youtubeTitle: input.youtubeTitle } : {}),
        ...(input.youtubeDescription ? { youtubeDescription: input.youtubeDescription } : {}),
        ...(input.youtubeTags ? { youtubeTags: JSON.stringify(input.youtubeTags) } : {}),
      }).where(eq(videoJobs.id, input.jobId));

      return { success: true };
    }),

  approveVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];

      if (job.status !== "ready_for_review") {
        throw new Error(`Job is in status '${job.status}', expected 'ready_for_review'`);
      }

      const videoUrl = job.s3VideoUrl ?? job.descriptDownloadUrl;
      if (!videoUrl) throw new Error("No video URL available — cannot upload to YouTube");

      await db.update(videoJobs).set({ status: "approved", vaApprovedAt: Date.now() }).where(eq(videoJobs.id, input.jobId));
      await db.update(videoJobs).set({ status: "uploading" }).where(eq(videoJobs.id, input.jobId));

      try {
        const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
        const uploadResult = await uploadToYouTube({
          videoUrl,
          title: job.youtubeTitle ?? "Urban Monk Video",
          description: job.youtubeDescription ?? "",
          tags,
          privacyStatus: "public",
        });

        await db.update(videoJobs).set({
          status: "published",
          youtubeVideoId: uploadResult.videoId,
          publishedAt: Date.now(),
        }).where(eq(videoJobs.id, input.jobId));

        return { success: true, youtubeVideoId: uploadResult.videoId, youtubeVideoUrl: uploadResult.videoUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, input.jobId));
        throw err;
      }
    }),

  rejectVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(videoJobs).set({ status: "rejected", errorMessage: input.reason ?? "Rejected by VA" }).where(eq(videoJobs.id, input.jobId));
      return { success: true };
    }),

  retryVideoJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const jobs = await db.select({ retryCount: videoJobs.retryCount }).from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);

      await db.update(videoJobs).set({
        status: "pending",
        errorMessage: null,
        retryCount: (jobs[0].retryCount ?? 0) + 1,
        descriptImportJobId: null,
        descriptAgentJobId: null,
        descriptPublishJobId: null,
      }).where(eq(videoJobs.id, input.jobId));

      return { success: true };
    }),

  processScheduledVideoJobs: publicProcedure.mutation(async () => {
    return processScheduledVideoJobs();
  }),
});
