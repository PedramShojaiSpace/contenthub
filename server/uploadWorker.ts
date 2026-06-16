/**
 * uploadWorker.ts — Standalone YouTube upload worker
 *
 * This script is spawned as a DETACHED child process by the main server.
 * It runs independently of the Express/tRPC server, so server hot-reloads
 * and restarts do NOT kill it.
 *
 * Usage: spawned by videoPipelineRouter.ts via spawnUploadWorker()
 * Args: JOB_ID=<id> passed via environment variable
 *
 * The worker:
 *   1. Reads the job from the DB (gets descriptDownloadUrl, title, description, tags)
 *   2. Runs the full Descript export + YouTube upload pipeline
 *   3. Updates the job status in the DB when done
 *   4. Exits cleanly
 *
 * Logs are written to /tmp/upload-worker-<jobId>.log
 */

import "dotenv/config";
import * as fs from "fs";
import { createConnection } from "mysql2/promise";
import { uploadToYouTube } from "./youtubeUploader";
import { exportProject, getJobStatus } from "./descriptClient";
import { postVideoToSocialChannels } from "./videoSocialPoster";

const jobId = parseInt(process.env.JOB_ID ?? "0", 10);
if (!jobId) {
  console.error("JOB_ID env var is required");
  process.exit(1);
}

const logFile = `/tmp/upload-worker-${jobId}.log`;
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return createConnection(url);
}

async function run() {
  log(`=== Upload Worker started for Job #${jobId} ===`);

  const conn = await getDb();

  try {
    // Load job from DB
    const [rows] = await conn.execute(
      `SELECT id, video_job_status, vj_descript_project_id, vj_descript_download_url,
              vj_youtube_title, vj_youtube_description, vj_youtube_tags,
              vj_yt_upload_uri, vj_yt_upload_offset, vj_output_channels
       FROM video_jobs WHERE id = ?`,
      [jobId]
    ) as [any[], any];

    if (!rows.length) {
      log(`ERROR: Job #${jobId} not found in DB`);
      process.exit(1);
    }

    const job = rows[0];
    log(`Job loaded: status=${job.video_job_status}, title="${job.vj_youtube_title}"`);

    // ── Phase 1: Get Descript download URL ─────────────────────────────────────
    let downloadUrl: string | null = job.vj_descript_download_url;

    if (downloadUrl) {
      // Validate cached URL
      log(`Checking cached Descript URL...`);
      try {
        const headRes = await fetch(downloadUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        if (headRes.ok || headRes.status === 405) {
          log(`Cached URL valid (${headRes.status}). Skipping re-export.`);
        } else {
          log(`Cached URL expired (${headRes.status}). Will re-export.`);
          downloadUrl = null;
          await conn.execute(`UPDATE video_jobs SET vj_descript_download_url = NULL WHERE id = ?`, [jobId]);
        }
      } catch (e) {
        log(`HEAD check failed: ${e}. Will re-export.`);
        downloadUrl = null;
      }
    }

    if (!downloadUrl) {
      const projectId = job.vj_descript_project_id;
      if (!projectId) {
        throw new Error("No Descript project ID — cannot export");
      }

      // ── Check for an in-progress or recently completed publish job ──────────
      // Descript returns 429 if we try to start a new export while one is running.
      // Instead, check for existing jobs first and resume polling if found.
      let publishJobId: string | null = null;

      try {
        log(`Checking for existing Descript publish jobs for project: ${projectId}`);
        const listRes = await fetch(
          `https://descriptapi.com/v1/jobs?project_id=${encodeURIComponent(projectId)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.DESCRIPT_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (listRes.ok) {
          const listBody = await listRes.json() as { data?: Array<{ job_id: string; job_type: string; job_state: string; result?: { status?: string; download_url?: string } }> };
          const jobs = listBody.data ?? [];
          // Find the most recent publish job that is either running or successfully completed
          const publishJobs = jobs.filter(j => j.job_type === "publish");
          log(`Found ${publishJobs.length} publish job(s) for project`);

          // First: check if any job already succeeded with a download URL
          const successJob = publishJobs.find(
            j => j.job_state === "stopped" && j.result?.status === "success" && j.result?.download_url
          );
          if (successJob) {
            log(`Found completed publish job ${successJob.job_id} with download URL. Using it.`);
            downloadUrl = successJob.result!.download_url!;
            await conn.execute(
              `UPDATE video_jobs SET vj_descript_download_url = ? WHERE id = ?`,
              [downloadUrl, jobId]
            );
            log(`Descript export complete (from existing job). Download URL cached.`);
          } else {
            // Check if there's a running job we can poll
            const runningJob = publishJobs.find(j => j.job_state === "running");
            if (runningJob) {
              publishJobId = runningJob.job_id;
              log(`Found in-progress publish job ${publishJobId}. Will poll it instead of creating new export.`);
            }
          }
        }
      } catch (listErr) {
        log(`Warning: Could not list existing publish jobs: ${listErr}. Will try creating new export.`);
      }

      // ── Start new export if no existing job found ────────────────────────────
      if (!downloadUrl && !publishJobId) {
        log(`Triggering Descript export for project: ${projectId}`);
        try {
          const exportResp = await exportProject({ projectId });
          publishJobId = exportResp.job_id;
          log(`Descript export job ID: ${publishJobId}`);
        } catch (exportErr) {
          const errMsg = exportErr instanceof Error ? exportErr.message : String(exportErr);
          // Handle 429 — another job is running, try to find it via the list endpoint
          if (errMsg.includes("429") || errMsg.includes("already running")) {
            log(`Descript 429: A publish job is already running. Checking job list again...`);
            // Wait a moment then re-check
            await new Promise(r => setTimeout(r, 5_000));
            const retryRes = await fetch(
              `https://descriptapi.com/v1/jobs?project_id=${encodeURIComponent(projectId)}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.DESCRIPT_API_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (retryRes.ok) {
              const retryBody = await retryRes.json() as { data?: Array<{ job_id: string; job_type: string; job_state: string; result?: { status?: string; download_url?: string } }> };
              const retryJobs = (retryBody.data ?? []).filter(j => j.job_type === "publish");
              const runningJob = retryJobs.find(j => j.job_state === "running");
              const successJob = retryJobs.find(
                j => j.job_state === "stopped" && j.result?.status === "success" && j.result?.download_url
              );
              if (successJob) {
                downloadUrl = successJob.result!.download_url!;
                await conn.execute(
                  `UPDATE video_jobs SET vj_descript_download_url = ? WHERE id = ?`,
                  [downloadUrl, jobId]
                );
                log(`Found completed job after 429. Download URL cached.`);
              } else if (runningJob) {
                publishJobId = runningJob.job_id;
                log(`Found running job after 429: ${publishJobId}. Will poll it.`);
              } else {
                throw new Error(`Descript 429 but no running/completed job found. ${errMsg}`);
              }
            } else {
              throw new Error(`Descript 429 and job list failed: ${errMsg}`);
            }
          } else {
            throw exportErr;
          }
        }
      }

      // ── Poll the publish job until complete ──────────────────────────────────
      if (!downloadUrl && publishJobId) {
        const maxAttempts = 80; // 80 × 15s = 20 min
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 15_000));
          const jobStatus = await getJobStatus(publishJobId);
          log(`Descript poll ${i + 1}/${maxAttempts}: state=${jobStatus.job_state}`);

          if (jobStatus.job_state === "stopped") {
            if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
              downloadUrl = jobStatus.result.download_url;
              await conn.execute(
                `UPDATE video_jobs SET vj_descript_download_url = ? WHERE id = ?`,
                [downloadUrl, jobId]
              );
              log(`Descript export complete. Download URL cached.`);
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
    }

    // ── Phase 2: Upload to YouTube ──────────────────────────────────────────────
    const tags = job.vj_youtube_tags ? JSON.parse(job.vj_youtube_tags) : [];
    log(`Starting YouTube upload...`);

    const uploadResult = await uploadToYouTube({
      videoUrl: downloadUrl!,
      title: job.vj_youtube_title ?? "Urban Monk Video",
      description: job.vj_youtube_description ?? "",
      tags,
      privacyStatus: "unlisted",
      jobId,
    });

    // ── Phase 3: Mark YouTube upload complete ─────────────────────────────────
    await conn.execute(
      `UPDATE video_jobs SET video_job_status = 'uploaded_unlisted', vj_youtube_video_id = ?,
       vj_yt_upload_uri = NULL, vj_yt_upload_offset = NULL, vj_error_message = NULL
       WHERE id = ?`,
      [uploadResult.videoId, jobId]
    );

    log(`✅ Job #${jobId} YouTube upload complete. Video ID: ${uploadResult.videoId}`);
    log(`   URL: ${uploadResult.videoUrl}`);

    // ── Phase 4: Post to social channels via Buffer ────────────────────────────
    const outputChannels: string[] = (() => {
      try { return JSON.parse(job.vj_output_channels ?? '["youtube"]'); }
      catch { return ["youtube"]; }
    })();

    const socialChannels = outputChannels.filter((ch: string) => ch !== "youtube");
    if (socialChannels.length > 0) {
      log(`[Social] Output channels: ${outputChannels.join(", ")}`);
      try {
        const socialResults = await postVideoToSocialChannels({
          jobId,
          title: job.vj_youtube_title ?? "Urban Monk Video",
          description: job.vj_youtube_description ?? "",
          youtubeVideoId: uploadResult.videoId,
          outputChannels,
          log,
        });

        // Save social results as JSON in the error_message field (repurposed as notes field)
        // Only if all succeeded — otherwise leave error message for failed channels
        const failedChannels = socialResults.filter(r => !r.success);
        if (failedChannels.length > 0) {
          const failMsg = failedChannels.map(r => `${r.channel}: ${r.error}`).join("; ");
          log(`[Social] ⚠️ Some channels failed: ${failMsg}`);
          await conn.execute(
            `UPDATE video_jobs SET vj_error_message = ? WHERE id = ?`,
            [`Social posting partial failure: ${failMsg}`.substring(0, 500), jobId]
          );
        } else {
          log(`[Social] All channels queued successfully in Buffer.`);
        }
      } catch (socialErr) {
        const socialMsg = socialErr instanceof Error ? socialErr.message : String(socialErr);
        log(`[Social] ❌ Social posting error: ${socialMsg}`);
        // Don't fail the whole job — YouTube upload succeeded
        await conn.execute(
          `UPDATE video_jobs SET vj_error_message = ? WHERE id = ?`,
          [`Social posting error: ${socialMsg}`.substring(0, 500), jobId]
        );
      }
    } else {
      log(`[Social] YouTube-only job — no social channels to post.`);
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`❌ Job #${jobId} failed: ${message}`);
    await conn.execute(
      `UPDATE video_jobs SET video_job_status = 'failed', vj_error_message = ?,
       vj_yt_upload_uri = NULL, vj_yt_upload_offset = NULL
       WHERE id = ?`,
      [message.substring(0, 500), jobId]
    );
  } finally {
    await conn.end();
    logStream.end();
  }
}

run().catch(err => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
