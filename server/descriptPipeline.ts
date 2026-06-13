/**
 * Descript Video Pipeline Orchestrator
 * Uses actual descriptClient.ts exports: createProjectFromScript, getJobStatus, runUnderlordAgent, exportProject
 * DB status enum: pending|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
 */

import { eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { generateBrollPrompt } from "./brollPromptGenerator";
import {
  createProjectFromScript,
  getJobStatus,
  runUnderlordAgent,
  exportProject,
} from "./descriptClient";

export async function processVideoJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const rows = await db.select().from(videoJobs).where(eq(videoJobs.id, jobId)).limit(1);
  if (!rows.length) throw new Error(`Video job ${jobId} not found`);
  let job = rows[0];

  try {
    // Step 1: Generate B-roll prompt + seed YouTube metadata
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

    // Step 2: Start Descript import
    if (!job.descriptImportJobId) {
      const importResult = await createProjectFromScript({
        projectName: (job.youtubeTitle ?? "Urban Monk Video").substring(0, 100),
        scriptText: job.scriptText,
      });

      await db.update(videoJobs).set({
        descriptImportJobId: importResult.job_id,
        descriptProjectId: importResult.project_id,
        status: "importing",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptImportJobId: importResult.job_id, descriptProjectId: importResult.project_id, status: "importing" };
    }

    // Step 3: Poll import — start Underlord when done
    if (job.status === "importing" && job.descriptImportJobId && !job.descriptAgentJobId) {
      const importStatus = await getJobStatus(job.descriptImportJobId);

      if (importStatus.status === "pending" || importStatus.status === "processing") return;
      if (importStatus.status === "failed") throw new Error(`Import failed: ${importStatus.error ?? "unknown"}`);

      const projectId = importStatus.result?.project_id ?? job.descriptProjectId!;
      const agentResult = await runUnderlordAgent({
        projectId,
        prompt: job.brollPrompt ?? "Remove filler words, add captions, and improve audio quality.",
      });

      await db.update(videoJobs).set({
        descriptProjectId: projectId,
        descriptAgentJobId: agentResult.job_id,
        status: "editing",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptProjectId: projectId, descriptAgentJobId: agentResult.job_id, status: "editing" };
    }

    // Step 4: Poll Underlord — start export when done
    if (job.status === "editing" && job.descriptAgentJobId && !job.descriptPublishJobId) {
      const agentStatus = await getJobStatus(job.descriptAgentJobId);

      if (agentStatus.status === "pending" || agentStatus.status === "processing") return;
      if (agentStatus.status === "failed") throw new Error(`Agent failed: ${agentStatus.error ?? "unknown"}`);

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

    // Step 5: Poll export — upload to S3 when done
    if (job.status === "rendering" && job.descriptPublishJobId) {
      const exportStatus = await getJobStatus(job.descriptPublishJobId);

      if (exportStatus.status === "pending" || exportStatus.status === "processing") return;
      if (exportStatus.status === "failed") throw new Error(`Export failed: ${exportStatus.error ?? "unknown"}`);

      const downloadUrl = (exportStatus as any).download_url ?? exportStatus.result?.project_url;
      if (!downloadUrl) throw new Error("Export completed but no download URL");

      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.status}`);

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
