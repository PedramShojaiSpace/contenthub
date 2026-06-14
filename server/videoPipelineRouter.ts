/**
 * Video Pipeline tRPC Router
 * Status enum (actual DB): pending|importing|editing|rendering|ready_for_review|approved|uploading|uploaded_unlisted|published|failed|rejected
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { processScheduledVideoJobs } from "./descriptPipeline";
import { uploadToYouTube } from "./youtubeUploader";
import { exportProject, getJobStatus } from "./descriptClient";
import { invokeLLM } from "./_core/llm";
import { google } from "googleapis";
import { userCredentials } from "../drizzle/schema";

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
      if (!job.descriptProjectId) throw new Error("No Descript project ID — cannot re-export");

      await db.update(videoJobs).set({ status: "approved", vaApprovedAt: Date.now() }).where(eq(videoJobs.id, input.jobId));
      await db.update(videoJobs).set({ status: "uploading" }).where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget: Descript re-render + YouTube upload runs in background
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[BG Job #${input.jobId}]`;
        console.log(`${jobLabel} Background upload started for: "${job.youtubeTitle ?? 'Urban Monk Video'}"`);
        try {
          // ── Phase 1: Trigger Descript export ──────────────────────────────
          console.log(`${jobLabel} Triggering Descript export for project: ${job.descriptProjectId}`);
          const exportResp = await exportProject({ projectId: job.descriptProjectId! });
          const publishJobId = exportResp.job_id;
          console.log(`${jobLabel} Descript export job ID: ${publishJobId}`);

          let downloadUrl: string | undefined;
          const maxAttempts = 80; // increased: 80 x 15s = 20 min max for Descript
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 15_000));
            const jobStatus = await getJobStatus(publishJobId);
            console.log(`${jobLabel} Descript poll ${i + 1}/${maxAttempts}: job_state=${jobStatus.job_state}`);
            if (jobStatus.job_state === "stopped") {
              if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
                downloadUrl = jobStatus.result.download_url;
                console.log(`${jobLabel} Descript export complete. Download URL obtained.`);
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

          // ── Phase 2: Upload to YouTube ────────────────────────────────────
          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: downloadUrl,
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

          // ── Optimization: reuse cached Descript download URL if available ──
          // This avoids a 15-20 min Descript re-export when the URL is already stored.
          // descriptDownloadUrl is the real MP4 link; s3VideoUrl is only the share page preview.
          if (job.descriptDownloadUrl && job.descriptDownloadUrl.startsWith("http") && !job.descriptDownloadUrl.includes("share.descript.com")) {
            downloadUrl = job.descriptDownloadUrl;
            console.log(`${jobLabel} Reusing cached Descript download URL (skipping re-export).`);
          } else {
            // Fall back to fresh Descript export
            console.log(`${jobLabel} No cached download URL — triggering fresh Descript export for project: ${job.descriptProjectId}`);
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
                  // Cache it for future retries
                  await bgDb.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, input.jobId));
                  console.log(`${jobLabel} Descript export complete. Download URL cached.`);
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
            videoUrl: downloadUrl,
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
