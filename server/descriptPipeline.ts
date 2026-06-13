/**
 * Descript Video Pipeline Orchestrator
 *
 * Simplified flow using the Descript agent endpoint:
 *   1. Generate B-roll prompt + YouTube metadata via AI
 *   2. Create Descript project via agent — Underlord narrates with "Pedram Shojai" AI voice
 *   3. Poll agent job until stopped
 *   4. Export project to MP4
 *   5. Poll export job until stopped, download video, upload to S3
 *   6. Mark ready_for_review
 *
 * DB status enum: pending|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
 */

import { eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { generateBrollPrompt } from "./brollPromptGenerator";
import {
  createProjectWithVoice,
  runUnderlordAgent,
  getJobStatus,
  exportProject,
} from "./descriptClient";

export async function processVideoJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const rows = await db.select().from(videoJobs).where(eq(videoJobs.id, jobId)).limit(1);
  if (!rows.length) throw new Error(`Video job ${jobId} not found`);
  let job = rows[0];

  try {
    // ── Step 1: Generate B-roll prompt + seed YouTube metadata ───────────────
    if (!job.brollPrompt) {
      const brollResult = await generateBrollPrompt({
        scriptTitle: job.youtubeTitle ?? "Urban Monk Video",
        scriptText: job.scriptText,
        topic: job.youtubeTitle ?? "Urban Monk Video",
        keywords: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
      });

      await db.update(videoJobs).set({
        brollPrompt: brollResult.underlordPrompt,
        youtubeTitle: (brollResult.youtubeTitle ?? job.youtubeTitle ?? "Urban Monk Video").substring(0, 512),
        youtubeDescription: brollResult.youtubeDescription,
        youtubeTags: JSON.stringify(brollResult.youtubeTags),
        status: "importing",
      }).where(eq(videoJobs.id, jobId));

      const r = await db.select().from(videoJobs).where(eq(videoJobs.id, jobId)).limit(1);
      job = r[0];
    }

    // ── Step 2: Create Descript project via agent (Pedram Shojai AI voice) ───
    // We use descriptImportJobId to store the agent job_id for the creation step
    if (!job.descriptImportJobId) {
      const projectName = (job.youtubeTitle ?? "Urban Monk Video").substring(0, 100);
      const agentResult = await createProjectWithVoice({
        projectName,
        scriptText: job.scriptText,
        voiceName: "Pedram Shojai",
      });

      await db.update(videoJobs).set({
        descriptImportJobId: agentResult.job_id,
        descriptProjectId: agentResult.project_id,
        descriptShareUrl: agentResult.project_url,
        status: "importing",
      }).where(eq(videoJobs.id, jobId));

      job = {
        ...job,
        descriptImportJobId: agentResult.job_id,
        descriptProjectId: agentResult.project_id,
        descriptShareUrl: agentResult.project_url,
        status: "importing",
      };
    }

    // ── Step 3: Poll creation agent job ──────────────────────────────────────
    if (job.status === "importing" && job.descriptImportJobId && !job.descriptAgentJobId) {
      const jobStatus = await getJobStatus(job.descriptImportJobId);

      if (jobStatus.job_state === "running") return; // still processing, come back next cron
      if (jobStatus.job_state === "cancelled" || (jobStatus.result && jobStatus.result.status === "failed")) {
        throw new Error(`Descript project creation failed: ${jobStatus.result?.agent_response ?? "unknown"}`);
      }

      // Creation done — now run a second agent pass for B-roll/captions if we have a prompt
      const brollPrompt = job.brollPrompt ??
        "Remove filler words and long pauses. Add auto-captions. Insert HEAVY B-roll from the stock library — CRITICAL: cut to a new B-roll clip every 5 to 12 seconds throughout the ENTIRE video with NO exceptions, never linger on a single shot longer than 12 seconds. Use a high density of B-roll cuts to maintain visual momentum and viewer engagement.";

      const editResult = await runUnderlordAgent({
        projectId: job.descriptProjectId!,
        prompt: brollPrompt,
      });

      await db.update(videoJobs).set({
        descriptAgentJobId: editResult.job_id,
        status: "editing",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptAgentJobId: editResult.job_id, status: "editing" };
    }

    // ── Step 4: Poll editing agent job ───────────────────────────────────────
    if (job.status === "editing" && job.descriptAgentJobId && !job.descriptPublishJobId) {
      const agentStatus = await getJobStatus(job.descriptAgentJobId);

      if (agentStatus.job_state === "running") return;
      if (agentStatus.job_state === "cancelled" || (agentStatus.result && agentStatus.result.status === "failed")) {
        throw new Error(`Underlord editing failed: ${agentStatus.result?.agent_response ?? "unknown"}`);
      }

      // Editing done — start export
      const exportResult = await exportProject({
        projectId: job.descriptProjectId!,
        format: "mp4",
        resolution: "1080p",
      });

      await db.update(videoJobs).set({
        descriptPublishJobId: exportResult.job_id,
        status: "rendering",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptPublishJobId: exportResult.job_id, status: "rendering" };
    }

    // ── Step 5: Poll export job — download + upload to S3 ────────────────────
    if (job.status === "rendering" && job.descriptPublishJobId) {
      const exportStatus = await getJobStatus(job.descriptPublishJobId);

      if (exportStatus.job_state === "running") return;
      if (exportStatus.job_state === "cancelled" || (exportStatus.result && exportStatus.result.status === "failed")) {
        throw new Error(`Export failed: ${exportStatus.result?.agent_response ?? "unknown"}`);
      }

      const downloadUrl = exportStatus.result?.download_url ?? exportStatus.result?.share_url;
      if (!downloadUrl) throw new Error("Export completed but no download URL in result");

      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) throw new Error(`Failed to download video from Descript: ${videoResponse.status}`);

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const s3Key = `video-pipeline/${jobId}-${Date.now()}.mp4`;
      const { url: s3Url } = await storagePut(s3Key, videoBuffer, "video/mp4");

      await db.update(videoJobs).set({
        s3VideoKey: s3Key,
        s3VideoUrl: s3Url,
        descriptDownloadUrl: downloadUrl,
        status: "ready_for_review",
      }).where(eq(videoJobs.id, jobId));
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, jobId));
    throw err;
  }
}

export async function processScheduledVideoJobs(): Promise<{ processed: number; errors: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const pendingJobs = await db
    .select({ id: videoJobs.id })
    .from(videoJobs)
    .where(
      or(
        eq(videoJobs.status, "pending"),
        eq(videoJobs.status, "importing"),
        eq(videoJobs.status, "editing"),
        eq(videoJobs.status, "rendering")
      )
    );

  let processed = 0;
  const errors: string[] = [];

  for (const { id } of pendingJobs) {
    try {
      await processVideoJob(id);
      processed++;
    } catch (err) {
      errors.push(`Job ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed, errors };
}
