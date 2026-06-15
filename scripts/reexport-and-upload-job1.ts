/**
 * Re-export Job #1 from Descript and then run the full YouTube upload.
 * This bypasses the web UI and runs the exact same logic as approveVideoJob.
 * Run: npx tsx scripts/reexport-and-upload-job1.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { exportProject, getJobStatus } from "../server/descriptClient";
import { uploadToYouTube } from "../server/youtubeUploader";

async function run() {
  console.log("=== Re-export + Upload Job #1 ===\n");

  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, 1)).limit(1);
  const job = jobs[0];
  if (!job) { console.error("Job #1 not found"); process.exit(1); }

  console.log("Job status:", job.status);
  console.log("Descript project ID:", job.descriptProjectId);
  console.log("Current descriptDownloadUrl:", job.descriptDownloadUrl ?? "NULL");

  if (!job.descriptProjectId) {
    console.error("No Descript project ID — cannot re-export");
    process.exit(1);
  }

  // ── Reset job to uploading ──────────────────────────────────────────────────
  await db.update(videoJobs).set({
    status: "uploading",
    errorMessage: null,
    descriptDownloadUrl: null,
    youtubeVideoId: null,
  }).where(eq(videoJobs.id, 1));
  console.log("\nJob reset to uploading. Starting fresh Descript export...");

  // ── Trigger Descript export ─────────────────────────────────────────────────
  let downloadUrl: string;
  try {
    const exportResp = await exportProject({ projectId: job.descriptProjectId });
    const publishJobId = exportResp.job_id;
    console.log("Descript export job ID:", publishJobId);

    const maxAttempts = 80; // 80 x 15s = 20 min
    let found = false;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 15_000));
      const jobStatus = await getJobStatus(publishJobId);
      const pct = Math.round((i / maxAttempts) * 100);
      process.stdout.write(`\r  Descript poll ${i + 1}/${maxAttempts} (${pct}%): ${jobStatus.job_state}    `);

      if (jobStatus.job_state === "stopped") {
        if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
          downloadUrl = jobStatus.result.download_url;
          console.log(`\n✅ Descript export complete!`);
          console.log("  Download URL:", downloadUrl.substring(0, 80) + "...");

          // Cache in DB
          await db.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, 1));
          console.log("  Cached in DB.");
          found = true;
          break;
        } else {
          console.error(`\n❌ Descript export failed: ${JSON.stringify(jobStatus.result)}`);
          await db.update(videoJobs).set({ status: "failed", errorMessage: "Descript export failed" }).where(eq(videoJobs.id, 1));
          process.exit(1);
        }
      }
      if (jobStatus.job_state === "cancelled") {
        console.error("\n❌ Descript export was cancelled");
        await db.update(videoJobs).set({ status: "failed", errorMessage: "Descript export cancelled" }).where(eq(videoJobs.id, 1));
        process.exit(1);
      }
    }
    if (!found) {
      console.error("\n❌ Descript export timed out after 20 minutes");
      await db.update(videoJobs).set({ status: "failed", errorMessage: "Descript export timed out" }).where(eq(videoJobs.id, 1));
      process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Descript export error:", msg);
    await db.update(videoJobs).set({ status: "failed", errorMessage: msg }).where(eq(videoJobs.id, 1));
    process.exit(1);
  }

  // ── Upload to YouTube ───────────────────────────────────────────────────────
  console.log("\nStarting YouTube upload...");
  try {
    const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
    const result = await uploadToYouTube({
      videoUrl: downloadUrl!,
      title: job.youtubeTitle ?? "Urban Monk Video",
      description: job.youtubeDescription ?? "",
      tags,
      privacyStatus: "unlisted",
      jobId: 1,
    });

    await db.update(videoJobs).set({
      status: "uploaded_unlisted",
      youtubeVideoId: result.videoId,
    }).where(eq(videoJobs.id, 1));

    console.log(`\n✅ SUCCESS! Video uploaded to YouTube.`);
    console.log("  Video ID:", result.videoId);
    console.log("  URL:", result.videoUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ YouTube upload failed:", msg);
    await db.update(videoJobs).set({ status: "failed", errorMessage: msg }).where(eq(videoJobs.id, 1));
    process.exit(1);
  }

  process.exit(0);
}

run().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
