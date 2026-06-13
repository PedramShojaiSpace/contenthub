/**
 * Descript Video Pipeline Orchestrator
 *
 * Chains the async Descript steps with polling:
 *  1. generateBrollPrompt() → underlordPrompt + YouTube metadata
 *  2. createProjectFromScript() → import job_id
 *  3. Poll getJobStatus(job_id) until complete → project_id
 *  4. runUnderlordAgent(project_id, underlordPrompt) → agent_job_id
 *  5. Poll getAgentJobStatus(agent_job_id) until complete
 *  6. exportProject(project_id) → render_job_id
 *  7. Poll getExportJobStatus(render_job_id) until download_url available
 *  8. Download video → storagePut to S3 → save s3_url
 *  9. Update videoJobs row with status='ready_for_review'
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { generateBrollPrompt } from "./brollPromptGenerator";
import {
  createProjectFromScript,
  getJobStatus,
  runUnderlordAgent,
  getAgentJobStatus,
  exportProject,
  getExportJobStatus,
} from "./descriptClient";

// ── Polling helpers ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const MAX_POLL_ATTEMPTS = 80;    // 80 × 15s = 20 minutes max per stage

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilComplete<T extends { status: string; error?: string }>(
  label: string,
  pollFn: () => Promise<T>
): Promise<T> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const result = await pollFn();
    if (result.status === "complete") return result;
    if (result.status === "failed") {
      throw new Error(`${label} failed: ${result.error ?? "unknown error"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${label} timed out after ${MAX_POLL_ATTEMPTS} attempts`);
}

// ── Main pipeline function ────────────────────────────────────────────────────

/**
 * Process a single video job through the full Descript pipeline.
 * Called by the cron handler for jobs in 'queued' or 'importing'/'processing'/'rendering' status.
 */
export async function processVideoJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load the job
  const jobs = await db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.id, jobId))
    .limit(1);

  if (!jobs.length) throw new Error(`Video job ${jobId} not found`);
  const job = jobs[0];

  try {
    // ── Step 1: Generate B-roll prompt + YouTube metadata ─────────────────────
    if (!job.brollPrompt) {
      await db
        .update(videoJobs)
        .set({ status: "importing" })
        .where(eq(videoJobs.id, jobId));

      const brollResult = await generateBrollPrompt({
        scriptTitle: job.scriptTitle,
        scriptText: job.scriptText,
        topic: job.scriptTitle,
        keywords: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
      });

      await db
        .update(videoJobs)
        .set({
          brollPrompt: brollResult.underlordPrompt,
          youtubeTitle: brollResult.youtubeTitle.substring(0, 100),
          youtubeDescription: brollResult.youtubeDescription,
          youtubeTags: JSON.stringify(brollResult.youtubeTags),
        })
        .where(eq(videoJobs.id, jobId));

      // Reload
      const refreshed = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);
      Object.assign(job, refreshed[0]);
    }

    // ── Step 2: Create Descript project (if not already created) ─────────────
    if (!job.descriptJobId) {
      const importResult = await createProjectFromScript({
        projectName: job.scriptTitle,
        scriptText: job.scriptText,
      });

      await db
        .update(videoJobs)
        .set({
          descriptJobId: importResult.job_id,
          descriptProjectId: importResult.project_id,
          descriptProjectUrl: importResult.project_url,
          descriptDriveId: importResult.drive_id,
          status: "importing",
        })
        .where(eq(videoJobs.id, jobId));

      Object.assign(job, {
        descriptJobId: importResult.job_id,
        descriptProjectId: importResult.project_id,
      });
    }

    // ── Step 3: Poll import job until complete ────────────────────────────────
    if (job.descriptJobId && !job.descriptProjectId) {
      const importStatus = await pollUntilComplete(
        "Descript import",
        () => getJobStatus(job.descriptJobId!)
      );
      const projectId = importStatus.result?.project_id ?? job.descriptProjectId;
      await db
        .update(videoJobs)
        .set({ descriptProjectId: projectId, status: "processing" })
        .where(eq(videoJobs.id, jobId));
      Object.assign(job, { descriptProjectId: projectId });
    }

    // ── Step 4: Run Underlord agent ───────────────────────────────────────────
    // We reuse descriptJobId field to store the agent job ID after import is done
    // Use a separate field check: if status is 'importing' and project exists, run agent
    const currentJobs = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.id, jobId))
      .limit(1);
    const current = currentJobs[0];

    if (current.descriptProjectId && !current.renderJobId && current.brollPrompt) {
      await db
        .update(videoJobs)
        .set({ status: "processing" })
        .where(eq(videoJobs.id, jobId));

      const agentResult = await runUnderlordAgent({
        projectId: current.descriptProjectId,
        prompt: current.brollPrompt,
      });

      // Store agent job ID in descriptJobId temporarily (reuse field)
      await db
        .update(videoJobs)
        .set({ descriptJobId: agentResult.job_id })
        .where(eq(videoJobs.id, jobId));

      // ── Step 5: Poll agent job until complete ─────────────────────────────
      await pollUntilComplete(
        "Underlord agent",
        () => getAgentJobStatus(agentResult.job_id)
      );

      // ── Step 6: Export/render project ─────────────────────────────────────
      await db
        .update(videoJobs)
        .set({ status: "rendering" })
        .where(eq(videoJobs.id, jobId));

      const exportResult = await exportProject({
        projectId: current.descriptProjectId,
        format: "mp4",
        resolution: "1080p",
      });

      await db
        .update(videoJobs)
        .set({ renderJobId: exportResult.job_id })
        .where(eq(videoJobs.id, jobId));

      // ── Step 7: Poll export job until download URL available ──────────────
      const finalExport = await pollUntilComplete(
        "Descript export",
        () => getExportJobStatus(exportResult.job_id)
      );

      if (!finalExport.download_url) {
        throw new Error("Export completed but no download_url returned");
      }

      await db
        .update(videoJobs)
        .set({ videoDownloadUrl: finalExport.download_url })
        .where(eq(videoJobs.id, jobId));

      // ── Step 8: Download video and upload to S3 ───────────────────────────
      const videoResponse = await fetch(finalExport.download_url);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

      const s3Key = `video-pipeline/${jobId}-${Date.now()}.mp4`;
      const { url: s3Url } = await storagePut(s3Key, videoBuffer, "video/mp4");

      // ── Step 9: Mark as ready for VA review ──────────────────────────────
      await db
        .update(videoJobs)
        .set({
          videoS3Key: s3Key,
          videoS3Url: s3Url,
          status: "ready_for_review",
        })
        .where(eq(videoJobs.id, jobId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(videoJobs)
      .set({
        status: "failed",
        errorMessage: message,
      })
      .where(eq(videoJobs.id, jobId));
    throw err;
  }
}

/**
 * Process all pending video jobs.
 * Called by the cron handler every 15 minutes.
 */
export async function processScheduledVideoJobs(): Promise<{
  processed: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Find jobs that need processing
  const pendingJobs = await db
    .select({ id: videoJobs.id })
    .from(videoJobs)
    .where(
      eq(videoJobs.status, "queued")
    );

  // Also pick up stalled jobs in intermediate states (retry)
  const stalledJobs = await db
    .select({ id: videoJobs.id })
    .from(videoJobs)
    .where(
      eq(videoJobs.status, "importing")
    );

  const allJobs = [...pendingJobs, ...stalledJobs];

  let processed = 0;
  const errors: string[] = [];

  for (const { id } of allJobs) {
    try {
      await processVideoJob(id);
      processed++;
    } catch (err) {
      errors.push(`Job ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed, errors };
}
