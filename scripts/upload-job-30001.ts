/**
 * Upload job #30001 to YouTube.
 */
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { uploadToYouTube } from "../server/youtubeUploader";
import { exportProject, getJobStatus } from "../server/descriptClient";

const JOB_ID = 30001;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, JOB_ID)).limit(1);
  if (!jobs.length) throw new Error(`Job ${JOB_ID} not found`);
  const job = jobs[0];

  console.log(`Job #${JOB_ID}: "${job.youtubeTitle}"`);
  console.log(`Current status: ${job.status}`);
  console.log(`descriptDownloadUrl: ${job.descriptDownloadUrl ? job.descriptDownloadUrl.substring(0, 80) + '...' : 'null'}`);
  console.log(`descriptProjectId: ${job.descriptProjectId}`);

  if (!["ready_for_review", "approved", "uploading", "failed"].includes(job.status)) {
    throw new Error(`Job is in status '${job.status}' — not ready for upload`);
  }

  // Reset to approved + uploading
  await db.update(videoJobs).set({ status: "approved", vaApprovedAt: Date.now() }).where(eq(videoJobs.id, JOB_ID));
  await db.update(videoJobs).set({ status: "uploading" }).where(eq(videoJobs.id, JOB_ID));
  console.log("✅ Status set to uploading");

  let downloadUrl: string | undefined;

  // Phase 1: Try cached descriptDownloadUrl
  const cachedUrl = job.descriptDownloadUrl;
  const isRealMp4 = cachedUrl &&
    cachedUrl.startsWith("http") &&
    !cachedUrl.includes("share.descript.com");

  if (isRealMp4) {
    console.log("Checking cached Descript download URL...");
    try {
      const headRes = await fetch(cachedUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
      console.log(`HEAD response: ${headRes.status}`);
      if (headRes.ok || headRes.status === 405) {
        downloadUrl = cachedUrl;
        console.log("✅ Cached URL is valid — skipping re-export");
      } else {
        console.warn(`Cached URL returned ${headRes.status} — expired. Will re-export.`);
        await db.update(videoJobs).set({ descriptDownloadUrl: null }).where(eq(videoJobs.id, JOB_ID));
      }
    } catch (e) {
      console.warn(`HEAD check failed: ${e}. Will re-export.`);
    }
  }

  // Phase 2: Fresh Descript export if needed
  if (!downloadUrl) {
    if (!job.descriptProjectId) throw new Error("No Descript project ID — cannot re-export");
    console.log(`Triggering Descript export for project: ${job.descriptProjectId}`);
    const exportResp = await exportProject({ projectId: job.descriptProjectId });
    const publishJobId = exportResp.job_id;
    console.log(`Export job ID: ${publishJobId}`);

    const maxAttempts = 80;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 15_000));
      const jobStatus = await getJobStatus(publishJobId);
      console.log(`Poll ${i + 1}/${maxAttempts}: state=${jobStatus.job_state}`);
      if (jobStatus.job_state === "stopped") {
        if (jobStatus.result?.status === "success" && jobStatus.result.download_url) {
          downloadUrl = jobStatus.result.download_url;
          await db.update(videoJobs).set({ descriptDownloadUrl: downloadUrl }).where(eq(videoJobs.id, JOB_ID));
          console.log("✅ Descript export complete. Download URL cached.");
          break;
        } else {
          throw new Error(`Descript export failed: ${jobStatus.result?.status ?? "unknown"}`);
        }
      }
      if (jobStatus.job_state === "cancelled") throw new Error("Descript export cancelled");
    }
    if (!downloadUrl) throw new Error("Descript export timed out after 20 minutes");
  }

  // Phase 3: Upload to YouTube
  console.log("Starting YouTube upload...");
  const tags = job.youtubeTags ? JSON.parse(job.youtubeTags) : [];
  const uploadResult = await uploadToYouTube({
    videoUrl: downloadUrl!,
    title: job.youtubeTitle ?? "Urban Monk Video",
    description: job.youtubeDescription ?? "",
    tags,
    privacyStatus: "unlisted",
    jobId: JOB_ID,
  });

  await db.update(videoJobs).set({
    status: "uploaded_unlisted",
    youtubeVideoId: uploadResult.videoId,
  }).where(eq(videoJobs.id, JOB_ID));

  console.log(`\n✅ SUCCESS! Video uploaded to YouTube.`);
  console.log(`   Video ID: ${uploadResult.videoId}`);
  console.log(`   Watch URL: https://www.youtube.com/watch?v=${uploadResult.videoId}`);
  console.log(`   Studio URL: https://studio.youtube.com/video/${uploadResult.videoId}/edit`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error("❌ Upload failed:", err);
  process.exit(1);
});
