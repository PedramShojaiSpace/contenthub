/**
 * Descript Video Pipeline Orchestrator
 *
 * Simplified flow using the Descript agent endpoint:
 *   1. Generate B-roll prompt + YouTube metadata via AI
 *   2. Create Descript project via agent — Underlord narrates with Pedram AI voice
 *   3. Poll agent job until stopped
 *   4. Run B-roll editing agent pass
 *   5. Poll editing job until stopped
 *   6. Export project to MP4
 *   7. Poll export job — store Descript share URL (NO download), mark ready_for_review
 *   8. On VA approval: download MP4 + upload to S3 + upload to YouTube
 *
 * DB status enum: pending|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
 *
 * NOTE: We intentionally skip downloading the MP4 at step 7 because videos can be
 * 500MB–1GB. Instead we store the Descript share_url for VA preview and only
 * download on approval (handled in videoPipelineRouter approveVideoJob).
 */

import { eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
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

    // ── Step 2: Create Descript project via agent (Pedram FOR GUT COURSE READ voice) ───
    if (!job.descriptImportJobId) {
      const projectName = (job.youtubeTitle ?? "Urban Monk Video").substring(0, 100);
      const agentResult = await createProjectWithVoice({
        projectName,
        scriptText: job.scriptText,
        voiceName: "Pedram FOR GUT COURSE READ",
        ctaText: job.ctaText ?? undefined,
        ctaUrl: job.ctaUrl ?? undefined,
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

      // Creation done — now run a second agent pass for B-roll/captions
      const ctaSuffix = job.ctaText
        ? `\n\nEND SCREEN CTA (last 5 seconds): Add a title card at the very end of the video with this exact text: "${job.ctaText}" and the URL: "${job.ctaUrl ?? 'theurbanmonk.com'}". The card should be white text on a dark background and stay visible for 5 seconds.`
        : "";

      const brollPrompt = (job.brollPrompt ??
        "MANDATORY B-ROLL RULE: Place a new B-roll clip at EVERY 5 to 8 seconds — non-negotiable. No single shot may stay on screen longer than 8 seconds. Cut to a new clip immediately at the 8-second mark throughout the ENTIRE video from start to finish with zero gaps. Also: remove filler words and long pauses, add auto-captions, use stock footage that matches the content being discussed.") + ctaSuffix;

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

      // Editing done — start export (publish to get download URL)
      const exportResult = await exportProject({
        projectId: job.descriptProjectId!,
      });

      await db.update(videoJobs).set({
        descriptPublishJobId: exportResult.job_id,
        status: "rendering",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptPublishJobId: exportResult.job_id, status: "rendering" };
    }

    // ── Step 5: Poll export job — store share URL, mark ready_for_review ─────
    // We do NOT download the MP4 here (can be 500MB–1GB).
    // Instead we store the Descript share_url for VA preview.
    // The actual download + S3 upload happens on VA approval in videoPipelineRouter.
    if (job.status === "rendering" && job.descriptPublishJobId) {
      const exportStatus = await getJobStatus(job.descriptPublishJobId);

      if (exportStatus.job_state === "running") return;
      if (exportStatus.job_state === "cancelled" || (exportStatus.result && exportStatus.result.status === "failed")) {
        throw new Error(`Export failed: ${exportStatus.result?.agent_response ?? "unknown"}`);
      }

      // Store the share URL and download URL (for later use on approval)
      const shareUrl = exportStatus.result?.share_url ?? job.descriptShareUrl ?? "";
      const downloadUrl = exportStatus.result?.download_url ?? "";

      await db.update(videoJobs).set({
        // Use share_url as the preview URL in VA Dashboard (no download needed)
        s3VideoUrl: shareUrl,
        descriptDownloadUrl: downloadUrl,
        descriptShareUrl: shareUrl,
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

  // ── Crash recovery: reset orphaned jobs on startup ─────────────────────────
  // If the server restarted mid-pipeline, jobs may be stuck in importing/editing/rendering
  // with partial Descript state (e.g. descriptImportJobId set but no descriptProjectId).
  // Clear ALL Descript fields so they restart cleanly from the beginning.
  const stuckJobs = await db
    .select({ id: videoJobs.id, status: videoJobs.status, descriptProjectId: videoJobs.descriptProjectId, descriptImportJobId: videoJobs.descriptImportJobId })
    .from(videoJobs)
    .where(
      or(
        eq(videoJobs.status, "importing"),
        eq(videoJobs.status, "editing"),
        eq(videoJobs.status, "rendering")
      )
    );

  for (const stuckJob of stuckJobs) {
    // Only reset jobs that have orphaned state: descriptImportJobId set but no descriptProjectId
    // (indicates a partial failure mid-creation). Jobs with both set are actively being polled.
    if (stuckJob.descriptImportJobId && !stuckJob.descriptProjectId) {
      console.log(`[descriptPipeline] Crash recovery: resetting orphaned job #${stuckJob.id} (status=${stuckJob.status}, has importJobId but no projectId) → pending`);
      await db.update(videoJobs).set({
        status: "pending",
        descriptProjectId: null,
        descriptImportJobId: null,
        descriptAgentJobId: null,
        descriptPublishJobId: null,
        descriptShareUrl: null,
        descriptDownloadUrl: null,
        s3VideoUrl: null,
        errorMessage: null,
      }).where(eq(videoJobs.id, stuckJob.id));
    }
  }
  // ── End crash recovery ─────────────────────────────────────────────────────

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
