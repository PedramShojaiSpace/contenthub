/**
 * HeyGen Avatar Video Pipeline Router
 *
 * Handles the full lifecycle of cartoon avatar video generation:
 *   1. generateAvatarVideo — sends script to HeyGen API, stores video_id, sets status=rendering
 *   2. Background polling loop — polls HeyGen every 30s, downloads when complete, uploads to S3, triggers YouTube upload
 *   3. getAvatarVideoStatus — returns current job status for frontend polling
 *
 * HeyGen API reference:
 *   POST https://api.heygen.com/v2/video/generate   → { video_id }
 *   GET  https://api.heygen.com/v1/video.status.get?video_id={id} → { status, video_url }
 *
 * Avatar pipeline flow:
 *   script → HeyGen render (async, 5-20 min) → download video → S3 → YouTube upload (unlisted) → SEO Review → Make Public
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { uploadToYouTube } from "./youtubeUploader";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

const HEYGEN_API_BASE = "https://api.heygen.com";

// ── HeyGen API helpers ────────────────────────────────────────────────────────

async function heygenFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = ENV.heygenApiKey;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");

  return fetch(`${HEYGEN_API_BASE}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

interface HeyGenGenerateResponse {
  error: null | string;
  data: {
    video_id: string;
  };
}

interface HeyGenStatusResponse {
  error: null | string;
  data: {
    video_id: string;
    status: "pending" | "processing" | "waiting" | "failed" | "completed";
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    error?: { code: string; detail: string };
  };
}

/**
 * Calls HeyGen POST /v2/video/generate to start rendering an avatar video.
 * Returns the HeyGen video_id.
 */
async function startHeyGenRender(scriptText: string): Promise<string> {
  const avatarId = ENV.heygenAvatarId;
  const voiceId = ENV.heygenVoiceId;

  if (!avatarId) throw new Error("HEYGEN_AVATAR_ID is not configured");
  if (!voiceId) throw new Error("HEYGEN_VOICE_ID is not configured");

  const body = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: "517e3a662b6845c29e140ec6ccdb991a", // Pedram's avatar
          avatar_style: "normal",
          look_id: avatarId, // look_id from HEYGEN_AVATAR_ID env var
        },
        voice: {
          type: "text",
          input_text: scriptText,
          voice_id: voiceId,
          speed: 1.0,
        },
        background: {
          type: "color",
          value: "#f5f0e8", // warm parchment — matches Urban Monk brand
        },
      },
    ],
    dimension: {
      width: 1920,
      height: 1080,
    },
    aspect_ratio: null,
    test: false,
  };

  const res = await heygenFetch("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen generate failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as HeyGenGenerateResponse;
  if (json.error) throw new Error(`HeyGen API error: ${json.error}`);
  if (!json.data?.video_id) throw new Error("HeyGen returned no video_id");

  return json.data.video_id;
}

/**
 * Polls HeyGen GET /v1/video.status.get?video_id={id} until completed or failed.
 * Returns the video_url when complete.
 * Throws on failure or timeout (max 90 minutes).
 */
async function pollHeyGenUntilComplete(
  heygenVideoId: string,
  jobLabel: string
): Promise<string> {
  const maxAttempts = 180; // 180 × 30s = 90 min max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 30_000));

    const res = await heygenFetch(`/v1/video.status.get?video_id=${heygenVideoId}`);
    if (!res.ok) {
      console.warn(`${jobLabel} HeyGen status check failed (${res.status}), will retry...`);
      continue;
    }

    const json = (await res.json()) as HeyGenStatusResponse;
    const status = json.data?.status;
    console.log(`${jobLabel} HeyGen poll ${i + 1}/${maxAttempts}: status=${status}`);

    if (status === "completed") {
      const videoUrl = json.data?.video_url;
      if (!videoUrl) throw new Error("HeyGen completed but no video_url in response");
      return videoUrl;
    }

    if (status === "failed") {
      const detail = json.data?.error?.detail ?? "unknown error";
      throw new Error(`HeyGen render failed: ${detail}`);
    }

    // pending / processing / waiting — keep polling
  }

  throw new Error("HeyGen render timed out after 90 minutes");
}

/**
 * Downloads a video from a URL and uploads it to S3.
 * Returns the S3 URL.
 */
async function downloadAndUploadToS3(
  videoUrl: string,
  jobId: number,
  jobLabel: string
): Promise<{ s3Key: string; s3Url: string }> {
  console.log(`${jobLabel} Downloading HeyGen video from: ${videoUrl}`);

  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(300_000) }); // 5 min download timeout
  if (!res.ok) throw new Error(`Failed to download HeyGen video (${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`${jobLabel} Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB. Uploading to S3...`);

  const timestamp = Date.now();
  const s3Key = `avatar-videos/job-${jobId}-${timestamp}.mp4`;
  const { url: s3Url } = await storagePut(s3Key, buffer, "video/mp4");

  console.log(`${jobLabel} Uploaded to S3: ${s3Url}`);
  return { s3Key, s3Url };
}

// ── tRPC Router ───────────────────────────────────────────────────────────────

export const heygenRouter = router({
  /**
   * generateAvatarVideo
   *
   * Starts the HeyGen avatar video render for a given job.
   * The job must exist and have a scriptText.
   * Sets videoType='avatar', status='rendering', stores heygenVideoId.
   * Background polling loop handles the rest.
   */
  generateAvatarVideo: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const jobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, input.jobId))
        .limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);

      const job = jobs[0];
      if (!job.scriptText) throw new Error("Job has no script text — cannot generate avatar video");

      // Allow generation from: pending, approved, failed, ready_for_review
      const allowedStatuses = ["pending", "approved", "failed", "ready_for_review"];
      if (!allowedStatuses.includes(job.status)) {
        throw new Error(
          `Job is in status '${job.status}' — avatar generation only allowed from: ${allowedStatuses.join(", ")}`
        );
      }

      // Step 1: Call HeyGen API to start render
      const heygenVideoId = await startHeyGenRender(job.scriptText);
      console.log(`[HeyGen Job #${input.jobId}] Started render. HeyGen video_id: ${heygenVideoId}`);

      // Step 2: Update job record
      await db
        .update(videoJobs)
        .set({
          videoType: "avatar",
          heygenVideoId,
          status: "rendering",
          errorMessage: null,
        })
        .where(eq(videoJobs.id, input.jobId));

      // Step 3: Fire-and-forget background pipeline
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[HeyGen Job #${input.jobId}]`;

        try {
          // ── Phase 1: Poll HeyGen until render is complete ──────────────────
          console.log(`${jobLabel} Polling HeyGen for render completion...`);
          const heygenVideoUrl = await pollHeyGenUntilComplete(heygenVideoId, jobLabel);
          console.log(`${jobLabel} HeyGen render complete. Video URL: ${heygenVideoUrl}`);

          // ── Phase 2: Download + upload to S3 ──────────────────────────────
          const { s3Key, s3Url } = await downloadAndUploadToS3(heygenVideoUrl, input.jobId, jobLabel);

          await bgDb
            .update(videoJobs)
            .set({
              s3VideoKey: s3Key,
              s3VideoUrl: s3Url,
              status: "uploading",
            })
            .where(eq(videoJobs.id, input.jobId));

          // ── Phase 3: Upload to YouTube as unlisted ─────────────────────────
          console.log(`${jobLabel} Uploading to YouTube (unlisted)...`);
          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: s3Url,
            title: job.youtubeTitle ?? "Urban Monk Avatar Video",
            description: job.youtubeDescription ?? "",
            tags,
            privacyStatus: "unlisted",
            jobId: input.jobId,
          });

          await bgDb
            .update(videoJobs)
            .set({
              status: "uploaded_unlisted",
              youtubeVideoId: uploadResult.videoId,
            })
            .where(eq(videoJobs.id, input.jobId));

          console.log(`${jobLabel} ✅ Avatar pipeline complete. YouTube video ID: ${uploadResult.videoId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${jobLabel} ❌ Avatar pipeline failed: ${message}`);
          await bgDb
            .update(videoJobs)
            .set({ status: "failed", errorMessage: message })
            .where(eq(videoJobs.id, input.jobId));
        }
      })();

      return {
        success: true,
        heygenVideoId,
        status: "rendering",
        message:
          "HeyGen avatar render started. The cartoon avatar video will be processed and uploaded to YouTube automatically (typically 10–30 minutes). The dashboard will update when done.",
      };
    }),

  /**
   * getAvatarVideoStatus
   *
   * Returns the current status of a video job for frontend polling.
   * Also returns the HeyGen video_id so the frontend can show a direct link.
   */
  getAvatarVideoStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const jobs = await db
        .select({
          id: videoJobs.id,
          status: videoJobs.status,
          videoType: videoJobs.videoType,
          heygenVideoId: videoJobs.heygenVideoId,
          youtubeVideoId: videoJobs.youtubeVideoId,
          errorMessage: videoJobs.errorMessage,
          updatedAt: videoJobs.updatedAt,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, input.jobId))
        .limit(1);

      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);
      return jobs[0];
    }),

  /**
   * retryAvatarVideo
   *
   * Re-triggers the HeyGen render for a job that failed during the avatar pipeline.
   * Clears the old heygenVideoId and starts a fresh render.
   */
  retryAvatarVideo: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const jobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, input.jobId))
        .limit(1);
      if (!jobs.length) throw new Error(`Video job ${input.jobId} not found`);

      const job = jobs[0];
      if (job.videoType !== "avatar") {
        throw new Error("This job is not an avatar video job");
      }
      if (!["failed", "rendering"].includes(job.status)) {
        throw new Error(`Job is in status '${job.status}' — retry only allowed from failed or rendering`);
      }
      if (!job.scriptText) throw new Error("Job has no script text — cannot retry avatar video");

      // Start fresh HeyGen render
      const heygenVideoId = await startHeyGenRender(job.scriptText);
      console.log(`[HeyGen Retry Job #${input.jobId}] New render started. HeyGen video_id: ${heygenVideoId}`);

      await db
        .update(videoJobs)
        .set({
          heygenVideoId,
          status: "rendering",
          errorMessage: null,
        })
        .where(eq(videoJobs.id, input.jobId));

      // Fire-and-forget background pipeline (same as generateAvatarVideo)
      (async () => {
        const bgDb = await getDb();
        if (!bgDb) return;
        const jobLabel = `[HeyGen Retry Job #${input.jobId}]`;

        try {
          const heygenVideoUrl = await pollHeyGenUntilComplete(heygenVideoId, jobLabel);
          const { s3Key, s3Url } = await downloadAndUploadToS3(heygenVideoUrl, input.jobId, jobLabel);

          await bgDb
            .update(videoJobs)
            .set({ s3VideoKey: s3Key, s3VideoUrl: s3Url, status: "uploading" })
            .where(eq(videoJobs.id, input.jobId));

          const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
          const uploadResult = await uploadToYouTube({
            videoUrl: s3Url,
            title: job.youtubeTitle ?? "Urban Monk Avatar Video",
            description: job.youtubeDescription ?? "",
            tags,
            privacyStatus: "unlisted",
            jobId: input.jobId,
          });

          await bgDb
            .update(videoJobs)
            .set({ status: "uploaded_unlisted", youtubeVideoId: uploadResult.videoId })
            .where(eq(videoJobs.id, input.jobId));

          console.log(`${jobLabel} ✅ Retry complete. YouTube video ID: ${uploadResult.videoId}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${jobLabel} ❌ Retry failed: ${message}`);
          await bgDb
            .update(videoJobs)
            .set({ status: "failed", errorMessage: message })
            .where(eq(videoJobs.id, input.jobId));
        }
      })();

      return {
        success: true,
        heygenVideoId,
        message: "HeyGen avatar render restarted. Dashboard will update when done.",
      };
    }),
});
