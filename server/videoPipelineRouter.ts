/**
 * Video Pipeline tRPC Router
 * Status enum (actual DB): pending|importing|editing|rendering|ready_for_review|approved|uploading|uploaded_unlisted|published|failed|rejected
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoJobs, contentItems } from "../drizzle/schema";
import { processScheduledVideoJobs } from "./descriptPipeline";
import { uploadToYouTube } from "./youtubeUploader";
import { exportProject, getJobStatus } from "./descriptClient";
import { invokeLLM } from "./_core/llm";
import { google } from "googleapis";
import { userCredentials } from "../drizzle/schema";
import { fetchSingleWpPost, updateWpPostContent, createWpPost } from "./wordpress";

const VIDEO_JOB_STATUSES = [
  "pending", "importing", "editing", "rendering",
  "ready_for_review", "approved", "uploading", "uploaded_unlisted", "published", "failed", "rejected",
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

  getJobByTitle: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const jobs = await db
        .select({ id: videoJobs.id, status: videoJobs.status, youtubeVideoId: videoJobs.youtubeVideoId, errorMessage: videoJobs.errorMessage })
        .from(videoJobs)
        .where(eq(videoJobs.youtubeTitle, input.title.substring(0, 512)))
        .orderBy(desc(videoJobs.createdAt))
        .limit(1);
      return jobs[0] ?? null;
    }),

  getVideoJobs: protectedProcedure
    .input(z.object({
      status: z.enum(VIDEO_JOB_STATUSES).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Join with content_items to get blog URL and embed status for the closed-loop UI
      const baseQuery = db
        .select({
          id: videoJobs.id,
          contentItemId: videoJobs.contentItemId,
          scriptText: videoJobs.scriptText,
          brollPrompt: videoJobs.brollPrompt,
          descriptProjectId: videoJobs.descriptProjectId,
          descriptImportJobId: videoJobs.descriptImportJobId,
          descriptAgentJobId: videoJobs.descriptAgentJobId,
          descriptPublishJobId: videoJobs.descriptPublishJobId,
          descriptShareUrl: videoJobs.descriptShareUrl,
          descriptDownloadUrl: videoJobs.descriptDownloadUrl,
          s3VideoKey: videoJobs.s3VideoKey,
          s3VideoUrl: videoJobs.s3VideoUrl,
          youtubeVideoId: videoJobs.youtubeVideoId,
          youtubeTitle: videoJobs.youtubeTitle,
          youtubeDescription: videoJobs.youtubeDescription,
          youtubeTags: videoJobs.youtubeTags,
          youtubeThumbnailUrl: videoJobs.youtubeThumbnailUrl,
          videoType: videoJobs.videoType,
          heygenVideoId: videoJobs.heygenVideoId,
          status: videoJobs.status,
          errorMessage: videoJobs.errorMessage,
          retryCount: videoJobs.retryCount,
          vaApprovedAt: videoJobs.vaApprovedAt,
          publishedAt: videoJobs.publishedAt,
          createdAt: videoJobs.createdAt,
          updatedAt: videoJobs.updatedAt,
          // Blog <-> Video closed-loop fields
          blogUrl: contentItems.publishUrl,
          blogEmbedStatus: contentItems.embeddedYoutubeEmbedStatus,
        })
        .from(videoJobs)
        .leftJoin(contentItems, eq(videoJobs.contentItemId, contentItems.id))
        .orderBy(desc(videoJobs.createdAt))
        .limit(input.limit);

      if (input.status) return baseQuery.where(eq(videoJobs.status, input.status));
      return baseQuery;
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
      // Allow re-approval from ready_for_review, uploading (stuck), or failed
      const approvableStatuses = ["ready_for_review", "uploading", "failed"];
      if (!approvableStatuses.includes(job.status)) {
        throw new Error(`Job is in status '${job.status}' — can only approve from: ${approvableStatuses.join(", ")}`);
      }
      if (!job.descriptProjectId && !job.descriptDownloadUrl) throw new Error("No Descript project ID or download URL — cannot upload");

      await db.update(videoJobs).set({ status: "approved", vaApprovedAt: Date.now() }).where(eq(videoJobs.id, input.jobId));
      await db.update(videoJobs).set({ status: "uploading" }).where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget: Descript re-render + YouTube upload runs in background
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[BG Job #${input.jobId}]`;
        console.log(`${jobLabel} Background upload started for: "${job.youtubeTitle ?? 'Urban Monk Video'}"`);
        try {
          let downloadUrl: string | undefined;

          // ── Phase 1: Try to reuse cached Descript download URL ────────────
          // descriptDownloadUrl is the real signed GCS MP4 URL.
          // s3VideoUrl may be set to the share page URL (share.descript.com) — NEVER use that for upload.
          const cachedUrl = job.descriptDownloadUrl;
          const isRealMp4 = cachedUrl &&
            cachedUrl.startsWith("http") &&
            !cachedUrl.includes("share.descript.com");

          if (isRealMp4) {
            console.log(`${jobLabel} Checking if cached Descript download URL is still valid...`);
            try {
              const headRes = await fetch(cachedUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
              if (headRes.ok || headRes.status === 405) {
                downloadUrl = cachedUrl;
                console.log(`${jobLabel} Cached download URL is valid (${headRes.status}). Skipping re-export.`);
              } else {
                console.warn(`${jobLabel} Cached URL returned ${headRes.status} — expired. Will re-export from Descript.`);
                await bgDb.update(videoJobs).set({ descriptDownloadUrl: null }).where(eq(videoJobs.id, input.jobId));
              }
            } catch (headErr) {
              const headMsg = headErr instanceof Error ? headErr.message : String(headErr);
              console.warn(`${jobLabel} HEAD check failed (${headMsg}). Will re-export from Descript.`);
            }
          }

          // ── Phase 2: Fresh Descript export if no valid cached URL ─────────
          if (!downloadUrl) {
            if (!job.descriptProjectId) throw new Error("No Descript project ID — cannot re-export. Please use Force Re-export.");
            console.log(`${jobLabel} Triggering Descript export for project: ${job.descriptProjectId}`);
            const exportResp = await exportProject({ projectId: job.descriptProjectId! });
            const publishJobId = exportResp.job_id;
            console.log(`${jobLabel} Descript export job ID: ${publishJobId}`);

            const maxAttempts = 80; // 80 x 15s = 20 min max for Descript
            for (let i = 0; i < maxAttempts; i++) {
              await new Promise(r => setTimeout(r, 15_000));
              const jobStatus = await getJobStatus(publishJobId);
              console.log(`${jobLabel} Descript poll ${i + 1}/${maxAttempts}: job_state=${jobStatus.job_state}`);
              if (jobStatus.job_state === "stopped") {
                if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
                  downloadUrl = jobStatus.result.download_url;
                  // Cache the fresh URL
                  await bgDb.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, input.jobId));
                  console.log(`${jobLabel} Descript export complete. Download URL obtained and cached.`);
                  break;
                } else {
                  throw new Error(`Descript publish failed: ${jobStatus.result?.status ?? "unknown"}`);
                }
              }
              if (jobStatus.job_state === "cancelled") {
                throw new Error("Descript publish job was cancelled");
              }
            }
            if (!downloadUrl) throw new Error("Descript publish timed out after 20 minutes");
          }

          // ── Phase 3: Upload to YouTube ──────────────────────────────────
          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: downloadUrl!,
            title: job.youtubeTitle ?? "Urban Monk Video",
            description: job.youtubeDescription ?? "",
            tags,
            privacyStatus: "unlisted",
            jobId: input.jobId,
          });

          await bgDb.update(videoJobs).set({
            status: "uploaded_unlisted",
            youtubeVideoId: uploadResult.videoId,
          }).where(eq(videoJobs.id, input.jobId));
          console.log(`${jobLabel} ✅ Job complete. Video ID: ${uploadResult.videoId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${jobLabel} ❌ Job failed: ${message}`);
          await bgDb.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, input.jobId));
        }
      })();

      return { success: true, status: "uploading", message: "Video is being processed and uploaded to YouTube as unlisted. This typically takes 15–30 minutes for a full episode. The dashboard will update automatically when done." };
    }),

  /**
   * retryUploadToYouTube — re-triggers the Descript export + YouTube upload
   * for a job that is in 'approved' or 'failed' status.
   * This is the "Step 4" button for jobs that were reset or failed mid-upload.
   */
  retryUploadToYouTube: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];

      // Allow retry from approved, failed, or ready_for_review
      const allowedStatuses = ["approved", "failed", "ready_for_review"];
      if (!allowedStatuses.includes(job.status)) {
        throw new Error(`Job is in status '${job.status}' — can only retry from: ${allowedStatuses.join(", ")}`);
      }
      if (!job.descriptProjectId && !job.descriptDownloadUrl) {
        throw new Error("No Descript project ID or download URL — cannot retry");
      }

      await db.update(videoJobs).set({
        status: "uploading",
        errorMessage: null,
        vaApprovedAt: Date.now(),
      }).where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget background upload
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[Retry Job #${input.jobId}]`;
        console.log(`${jobLabel} Retry upload started for: "${job.youtubeTitle ?? 'Urban Monk Video'}"`);
        try {
          let downloadUrl: string | undefined;

          // ── Optimization: reuse cached Descript download URL if still valid ──
          // Descript export URLs expire after ~24 hours (403 Forbidden when expired).
          // We do a quick HEAD check before reusing; if expired, we re-export.
          const cachedUrl = job.descriptDownloadUrl;
          const urlLooksValid = cachedUrl &&
            cachedUrl.startsWith("http") &&
            !cachedUrl.includes("share.descript.com");

          if (urlLooksValid) {
            console.log(`${jobLabel} Checking if cached Descript URL is still valid...`);
            try {
              const headRes = await fetch(cachedUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
              if (headRes.ok || headRes.status === 405) {
                // 405 = Method Not Allowed but server responded = URL is live
                downloadUrl = cachedUrl;
                console.log(`${jobLabel} Cached URL is valid (status ${headRes.status}). Skipping re-export.`);
              } else {
                console.warn(`${jobLabel} Cached URL returned ${headRes.status} — URL has expired. Triggering fresh Descript export.`);
                // Clear the stale URL so future retries don't try it again
                await bgDb.update(videoJobs).set({ descriptDownloadUrl: null }).where(eq(videoJobs.id, input.jobId));
              }
            } catch (headErr) {
              const headMsg = headErr instanceof Error ? headErr.message : String(headErr);
              console.warn(`${jobLabel} HEAD check failed (${headMsg}). Will attempt fresh Descript export.`);
            }
          }

          if (!downloadUrl) {
            // Fresh Descript export (either no cached URL or it expired)
            if (!job.descriptProjectId) throw new Error("No Descript project ID — cannot re-export");
            console.log(`${jobLabel} Triggering fresh Descript export for project: ${job.descriptProjectId}`);
            const exportResp = await exportProject({ projectId: job.descriptProjectId! });
            const publishJobId = exportResp.job_id;
            console.log(`${jobLabel} Descript export job ID: ${publishJobId}`);

            const maxAttempts = 80; // 80 x 15s = 20 min
            for (let i = 0; i < maxAttempts; i++) {
              await new Promise(r => setTimeout(r, 15_000));
              const jobStatus = await getJobStatus(publishJobId);
              console.log(`${jobLabel} Descript poll ${i + 1}/${maxAttempts}: job_state=${jobStatus.job_state}`);
              if (jobStatus.job_state === "stopped") {
                if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
                  downloadUrl = jobStatus.result.download_url;
                  // Cache the fresh URL for the next retry window
                  await bgDb.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, input.jobId));
                  console.log(`${jobLabel} Descript export complete. Fresh URL cached.`);
                  break;
                } else {
                  throw new Error(`Descript publish failed: ${jobStatus.result?.status ?? "unknown"}`);
                }
              }
              if (jobStatus.job_state === "cancelled") {
                throw new Error("Descript publish job was cancelled");
              }
            }
            if (!downloadUrl) throw new Error("Descript publish timed out after 20 minutes");
          }

          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: downloadUrl!,
            title: job.youtubeTitle ?? "Urban Monk Video",
            description: job.youtubeDescription ?? "",
            tags,
            privacyStatus: "unlisted",
            jobId: input.jobId,
          });

          await bgDb.update(videoJobs).set({
            status: "uploaded_unlisted",
            youtubeVideoId: uploadResult.videoId,
          }).where(eq(videoJobs.id, input.jobId));
          console.log(`${jobLabel} ✅ Retry complete. Video ID: ${uploadResult.videoId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${jobLabel} ❌ Retry failed: ${message}`);
          await bgDb.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, input.jobId));
        }
      })();

      return { success: true, message: "Retrying YouTube upload in the background. The dashboard will update when done." };
    }),

  /**
   * forceReexport
   *
   * Manually bypasses the cached Descript download URL and triggers a fresh export.
   * Use this when the cached URL is expired (403) or you want a clean re-export
   * (e.g., after editing the video in Descript post-approval).
   *
   * Clears descriptDownloadUrl, sets status to 'uploading', then runs the full
   * Descript export → YouTube upload pipeline in the background.
   */
  forceReexport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];

      if (!job.descriptProjectId) {
        throw new Error("No Descript project ID stored — cannot re-export. This job may have been created without a Descript project link.");
      }

      // Allow force re-export from any non-terminal status
      const blockedStatuses = ["uploading"];
      if (blockedStatuses.includes(job.status)) {
        throw new Error(`Job is currently uploading. Wait for it to finish or use Reset Stuck Job first.`);
      }

      // Clear the stale cached URL and reset to uploading
      await db.update(videoJobs).set({
        status: "uploading",
        errorMessage: null,
        descriptDownloadUrl: null,   // Force fresh export
        vaApprovedAt: Date.now(),
      }).where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget: fresh Descript export → YouTube upload
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[Force Re-export Job #${input.jobId}]`;
        console.log(`${jobLabel} Force re-export started for: "${job.youtubeTitle ?? 'Urban Monk Video'}"`);
        console.log(`${jobLabel} Cached Descript URL cleared. Triggering fresh export from project: ${job.descriptProjectId}`);
        try {
          const exportResp = await exportProject({ projectId: job.descriptProjectId! });
          const publishJobId = exportResp.job_id;
          console.log(`${jobLabel} Descript export job ID: ${publishJobId}`);

          let downloadUrl: string | undefined;
          const maxAttempts = 80; // 80 x 15s = 20 min
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 15_000));
            const jobStatus = await getJobStatus(publishJobId);
            console.log(`${jobLabel} Descript poll ${i + 1}/${maxAttempts}: job_state=${jobStatus.job_state}`);
            if (jobStatus.job_state === "stopped") {
              if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
                downloadUrl = jobStatus.result.download_url;
                await bgDb.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, input.jobId));
                console.log(`${jobLabel} Fresh Descript export complete. URL cached.`);
                break;
              } else {
                throw new Error(`Descript publish failed: ${jobStatus.result?.status ?? "unknown"}`);
              }
            }
            if (jobStatus.job_state === "cancelled") {
              throw new Error("Descript publish job was cancelled");
            }
          }
          if (!downloadUrl) throw new Error("Descript publish timed out after 20 minutes");

          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: downloadUrl!,
            title: job.youtubeTitle ?? "Urban Monk Video",
            description: job.youtubeDescription ?? "",
            tags,
            privacyStatus: "unlisted",
            jobId: input.jobId,
          });

          await bgDb.update(videoJobs).set({
            status: "uploaded_unlisted",
            youtubeVideoId: uploadResult.videoId,
          }).where(eq(videoJobs.id, input.jobId));
          console.log(`${jobLabel} ✅ Force re-export complete. Video ID: ${uploadResult.videoId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${jobLabel} ❌ Force re-export failed: ${message}`);
          await bgDb.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, input.jobId));
        }
      })();

      return { success: true, message: "Force re-export started. Descript will re-process the video (~15 min), then upload to YouTube automatically." };
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

  /**
   * generateSeoOptimization
   *
   * Applies the same Yoast-style SEO protocol used for blog publishing, adapted for YouTube:
   *  - Title ≤60 chars (green), focus keyword in first 3-4 words
   *  - Hook line 140-155 chars (Yoast meta desc equivalent), starts with focus keyword
   *  - Focus keyphrase: 2-4 words, what someone types into YouTube/Google
   *  - Semantic keywords: 5-8 LSI/related phrases
   *  - Full description: hook, value, timestamps, bio, CTA to Academy, links, hashtags
   *  - Tags: 15-20 ordered most-specific to most-broad
   *  - Pinned comment suggestion
   */
  generateSeoOptimization: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];

      const scriptSnippet = (job.scriptText ?? "").substring(0, 4000);
      const currentTitle = job.youtubeTitle ?? "";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert YouTube SEO strategist for Dr. Pedram Shojai (The Urban Monk).
You apply the same rigorous Yoast-style SEO protocol used for the blog, adapted for YouTube.

BRAND VOICE: Dr. Pedram Shojai — wise, grounded, integrative medicine, practical wisdom, spiritual but science-backed.
CHANNEL: The Urban Monk — health, longevity, mindfulness, energy, sleep, gut health, modern wellness.

YOUTUBE SEO RULES (mirrors Yoast blog protocol):

TITLE (Yoast SEO Title equivalent):
- HARD MAX 60 characters — count every character including spaces
- Focus keyword MUST appear in the first 3-4 words
- Format: "[Focus Keyword]: [Compelling Benefit]" or "[Focus Keyword] — [Hook]"
- Green zone: ≤60 chars. Amber: 61-70. Red: >70. AIM FOR GREEN.

HOOK LINE (Yoast Meta Description equivalent):
- EXACTLY 140-155 characters — count every character including spaces
- RULE 1: Start with the focus keyword as the very first words
- RULE 2: Stay between 140-155 chars — appears in YouTube search results
- RULE 3: Never end with ellipsis (...)
- RULE 4: Complete compelling sentence with focus keyword naturally in first 25 chars
- This is the first line of the YouTube description (before "Show More")

FOCUS KEYPHRASE (Yoast Focus Keyword equivalent):
- 2-4 word phrase — exactly what someone types into YouTube/Google
- Must appear in: title (first 3-4 words), hook line (first 25 chars), description (8+ times)
- Examples: "gut health protocol", "sleep optimization", "meditation for anxiety"

SECONDARY KEYPHRASE:
- 2-4 word semantic variation of the primary keyphrase

SEMANTIC KEYWORDS (Yoast LSI/semantic keywords):
- 5-8 related phrases supporting the focus keyphrase
- Mix of: broader terms, specific variations, question-based keywords

FULL DESCRIPTION (300-500 words):
1. Hook line (first 2 lines, 140-155 chars — before "Show More")
2. Blank line
3. Value paragraph: what viewer will learn (2-3 sentences, include focus keyphrase naturally 8+ times total across description)
4. Chapter timestamps (if script has clear sections — format: 0:00 Intro, 2:30 [Section])
5. About Dr. Pedram Shojai (2-3 sentences, authoritative bio)
6. Soft CTA: "Join the Urban Monk Academy at urbanmonkacademy.com for deeper practices and community"
7. Links section:
   🌐 Website: theurbanmonk.com
   🎓 Academy: urbanmonkacademy.com
   📚 Books: theurbanmonk.com/books
   📱 Instagram: @theurbanmonk
8. Hashtags (3-5): #TheUrbanMonk #[TopicHashtag] #[SecondaryHashtag]

TAGS (15-20 tags):
- Order: most specific → most broad
- Include: focus keyphrase exact, secondary keyphrase exact, 3-4 long-tail variations,
  2-3 topic-level tags, "urban monk", "pedram shojai", "integrative medicine", "wellness"
- No duplicate concepts — each tag adds unique search coverage

PINNED COMMENT:
- 1-2 sentences, includes focus keyword, drives to Academy or free resource`,
          },
          {
            role: "user",
            content: `Optimize this YouTube video for SEO using the full Yoast-style protocol.

Current title: ${currentTitle}
Script (first 4000 chars): ${scriptSnippet}

Apply all rules strictly. Title MUST be ≤60 chars. Hook line MUST be 140-155 chars and start with focus keyword.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "youtube_seo_yoast",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "YouTube title: HARD MAX 60 chars. Focus keyword in first 3-4 words.",
                },
                hookLine: {
                  type: "string",
                  description: "First description line (before Show More): EXACTLY 140-155 chars. Starts with focus keyword. No ellipsis.",
                },
                description: {
                  type: "string",
                  description: "Full YouTube description 300-500 words: hook, value, timestamps, bio, CTA, links, hashtags",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "15-20 YouTube tags ordered most-specific to most-broad",
                },
                primaryKeyword: {
                  type: "string",
                  description: "Focus keyphrase: 2-4 words, what someone types into YouTube/Google",
                },
                secondaryKeyword: {
                  type: "string",
                  description: "Secondary keyphrase: 2-4 word semantic variation",
                },
                semanticKeywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "5-8 LSI/semantic keyword phrases supporting the focus keyphrase",
                },
                pinnedCommentSuggestion: {
                  type: "string",
                  description: "Suggested pinned comment: 1-2 sentences with focus keyword, drives to Academy",
                },
                titleCharCount: {
                  type: "number",
                  description: "Exact character count of the title field",
                },
                hookLineCharCount: {
                  type: "number",
                  description: "Exact character count of the hookLine field",
                },
              },
              required: [
                "title", "hookLine", "description", "tags",
                "primaryKeyword", "secondaryKeyword", "semanticKeywords",
                "pinnedCommentSuggestion", "titleCharCount", "hookLineCharCount",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      const seo = typeof content === "string" ? JSON.parse(content) : content;

      // Auto-fix title if over 60 chars (mirrors Yoast hard-trim)
      let finalTitle = seo.title as string;
      if (finalTitle.length > 60) {
        const trimmed = finalTitle.slice(0, 57);
        const lastSpace = trimmed.lastIndexOf(" ");
        finalTitle = (lastSpace > 30 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd() + "...";
        console.warn(`[YouTube SEO] Title auto-trimmed: ${seo.title.length} → ${finalTitle.length} chars`);
      }

      // Auto-fix hook line if over 155 chars (mirrors Yoast meta desc hard-trim)
      let finalHookLine = seo.hookLine as string;
      if (finalHookLine.length > 155) {
        const trimmed = finalHookLine.slice(0, 152);
        const lastSpace = trimmed.lastIndexOf(" ");
        finalHookLine = (lastSpace > 100 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd().replace(/[,;:\-–—]$/, "").trimEnd();
        console.warn(`[YouTube SEO] Hook line auto-trimmed: ${seo.hookLine.length} → ${finalHookLine.length} chars`);
      }

      // Save SEO-optimized copy to job
      await db.update(videoJobs).set({
        youtubeTitle: finalTitle,
        youtubeDescription: seo.description as string,
        youtubeTags: JSON.stringify(seo.tags),
      }).where(eq(videoJobs.id, input.jobId));

      return {
        success: true,
        seo: {
          title: finalTitle,
          hookLine: finalHookLine,
          description: seo.description as string,
          tags: seo.tags as string[],
          primaryKeyword: seo.primaryKeyword as string,
          secondaryKeyword: seo.secondaryKeyword as string,
          semanticKeywords: seo.semanticKeywords as string[],
          pinnedCommentSuggestion: seo.pinnedCommentSuggestion as string,
          titleCharCount: finalTitle.length,
          hookLineCharCount: finalHookLine.length,
          // Yoast-style traffic-light status for the frontend
          titleStatus: (finalTitle.length <= 60 ? "green" : finalTitle.length <= 70 ? "amber" : "red") as "green" | "amber" | "red",
          hookLineStatus: (finalHookLine.length >= 140 && finalHookLine.length <= 155 ? "green"
            : finalHookLine.length >= 120 && finalHookLine.length <= 160 ? "amber" : "red") as "green" | "amber" | "red",
        },
      };
    }),

  /**
   * makePublic — flips YouTube video from unlisted → public with final reviewed metadata.
   * Mirrors the Yoast publish flow: review → approve → publish.
   */
  makePublic: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];
      if (!job.youtubeVideoId) throw new Error("No YouTube video ID — video has not been uploaded yet");

      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      if (!clientId || !clientSecret) throw new Error("YouTube OAuth credentials not configured");
      const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? "https://content.theurbanmonk.com/api/youtube/callback";
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      const credRows = await db.select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken }).from(userCredentials).limit(1);
      const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN ?? credRows[0]?.youtubeRefreshToken;
      if (!refreshToken) throw new Error("YouTube refresh token not found");
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
      await youtube.videos.update({
        part: ["snippet", "status"],
        requestBody: {
          id: job.youtubeVideoId,
          snippet: {
            title: (job.youtubeTitle ?? "Urban Monk Video").substring(0, 100),
            description: job.youtubeDescription ?? "",
            tags,
            categoryId: "26",
            defaultLanguage: "en",
            defaultAudioLanguage: "en",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        },
      } as any);

      await db.update(videoJobs).set({
        status: "published",
        publishedAt: Date.now(),
      }).where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget: Blog <-> Video closed loop
      if (job.contentItemId) {
        runBlogVideoLoop({
          db,
          youtube,
          videoId: job.youtubeVideoId!,
          contentItemId: job.contentItemId,
          job: job as Record<string, unknown>,
        }).catch(err => console.error(`[Blog<->Video] Loop error for job #${input.jobId}:`, err));
      }

      return {
        success: true,
        youtubeVideoId: job.youtubeVideoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${job.youtubeVideoId}`,
      };
    }),

  processScheduledVideoJobs: publicProcedure.mutation(async () => {
    return processScheduledVideoJobs();
  }),

  /**
   * resetStuckJob — force a job back to 'approved' so it can be re-triggered.
   * Use when a job has been stuck in 'uploading' for more than 30 minutes.
   */
  resetStuckJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobs = await db.select({ status: videoJobs.status, youtubeTitle: videoJobs.youtubeTitle }).from(videoJobs).where(eq(videoJobs.id, input.jobId)).limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      const job = jobs[0];
      // Only allow reset if stuck in uploading or failed
      if (job.status !== "uploading" && job.status !== "failed") {
        throw new Error(`Job is in status '${job.status}' — only 'uploading' or 'failed' jobs can be reset`);
      }
      console.log(`[resetStuckJob] Resetting job #${input.jobId} from '${job.status}' back to 'approved'`);
      await db.update(videoJobs).set({
        status: "approved",
        errorMessage: null,
      }).where(eq(videoJobs.id, input.jobId));
      return { success: true, message: `Job #${input.jobId} reset. Click "Upload to YouTube" to retry the upload.` };
    }),
});

// ---------------------------------------------------------------------------
// Blog <-> Video Closed-Loop Helper
// ---------------------------------------------------------------------------
async function runBlogVideoLoop(params: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  youtube: ReturnType<typeof google.youtube>;
  videoId: string;
  contentItemId: number;
  job: Record<string, unknown>;
}): Promise<void> {
  const { db, youtube, videoId, contentItemId, job } = params;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const wpBaseUrl = (process.env.WORDPRESS_URL ?? "https://theurbanmonk.com").replace(/\/$/, "");

  const youtubeEmbedBlock = `<!-- wp:embed {"url":"${youtubeUrl}","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->\n<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">\n<div class="wp-block-embed__wrapper">\n${youtubeUrl}\n</div>\n</figure>\n<!-- /wp:embed -->`;

  const items = await db.select({
    id: contentItems.id,
    wpPostId: contentItems.wpPostId,
    publishUrl: contentItems.publishUrl,
    embeddedYoutubeVideoId: contentItems.embeddedYoutubeVideoId,
  }).from(contentItems).where(eq(contentItems.id, contentItemId)).limit(1);

  const item = items[0];
  let blogUrl: string | null = item?.publishUrl ?? null;
  let wpPostId: number | null = item?.wpPostId ?? null;

  if (wpPostId) {
    if (item?.embeddedYoutubeVideoId !== videoId) {
      const postData = await fetchSingleWpPost(wpPostId);
      const existingContent = postData.content ?? "";
      if (!existingContent.includes(videoId)) {
        const newContent = youtubeEmbedBlock + "\n\n" + existingContent;
        await updateWpPostContent(wpPostId, newContent);
        console.log(`[Blog<->Video] Embedded YouTube video in WP post ${wpPostId}`);
      }
      await db.update(contentItems).set({
        embeddedYoutubeVideoId: videoId,
        embeddedYoutubeEmbedStatus: "embedded",
      }).where(eq(contentItems.id, contentItemId));
    }
    blogUrl = blogUrl ?? `${wpBaseUrl}/?p=${wpPostId}`;
  } else {
    const videoTitle = (job.youtubeTitle as string | null) ?? "Urban Monk Video";
    const videoDescription = (job.youtubeDescription as string | null) ?? "";
    const draftContent = youtubeEmbedBlock + "\n\n" +
      `<p>${videoDescription.split("\n")[0]}</p>\n\n` +
      `<p>Watch the full video above, and <a href="${youtubeUrl}" target="_blank" rel="noopener">subscribe on YouTube</a> for weekly insights from Dr. Pedram Shojai.</p>`;
    const slug = videoTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80);
    const tags = (job.youtubeTags as string | null) ? (JSON.parse(job.youtubeTags as string) as string[]) : [];
    const wpResult = await createWpPost({
      title: videoTitle,
      slug,
      content: draftContent,
      status: "draft",
      metaDescription: videoDescription.substring(0, 155),
      focusKeyword: tags[0],
    });
    wpPostId = wpResult.id;
    blogUrl = wpResult.link;
    await db.update(contentItems).set({
      wpPostId: wpResult.id,
      publishUrl: wpResult.link,
      embeddedYoutubeVideoId: videoId,
      embeddedYoutubeEmbedStatus: "embedded",
    }).where(eq(contentItems.id, contentItemId));
    console.log(`[Blog<->Video] Created WP draft post ${wpResult.id}: ${wpResult.link}`);
  }

  if (blogUrl) {
    const currentDesc = (job.youtubeDescription as string | null) ?? "";
    const blogCta = `\n\n📖 Read the full article with references and protocol:\n${blogUrl}`;
    if (!currentDesc.includes(blogUrl)) {
      const updatedDesc = (currentDesc + blogCta).substring(0, 5000);
      const listRes = await youtube.videos.list({ part: ["snippet"], id: [videoId] });
      const snippet = listRes.data.items?.[0]?.snippet;
      if (snippet) {
        await youtube.videos.update({
          part: ["snippet"],
          requestBody: { id: videoId, snippet: { ...snippet, description: updatedDesc } },
        } as any);
        await db.update(videoJobs).set({ youtubeDescription: updatedDesc })
          .where(eq(videoJobs.contentItemId, contentItemId));
        console.log(`[Blog<->Video] Appended blog URL to YouTube description for video ${videoId}`);
      }
    }
  }
}
