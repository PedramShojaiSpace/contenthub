/**
 * Approve job #30002 and trigger YouTube upload
 * Job is already ready_for_review with a valid Descript download URL
 */
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { uploadToYouTube } from "../server/youtubeUploader";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, 30002)).limit(1);
  if (!jobs.length) throw new Error("Job 30002 not found");
  const job = jobs[0];

  console.log(`Job #30002 status: ${job.status}`);
  console.log(`descriptDownloadUrl: ${job.descriptDownloadUrl}`);
  console.log(`descriptShareUrl: ${job.descriptShareUrl}`);
  console.log(`s3VideoUrl: ${job.s3VideoUrl}`);

  if (job.status !== "ready_for_review") {
    throw new Error(`Expected ready_for_review, got ${job.status}`);
  }

  // Set to approved first
  await db.update(videoJobs).set({ status: "approved" }).where(eq(videoJobs.id, 30002));
  console.log("✅ Status set to approved");

  // Get the download URL — prefer descriptDownloadUrl, fall back to s3VideoUrl
  const downloadUrl = job.descriptDownloadUrl || job.s3VideoUrl;
  if (!downloadUrl) throw new Error("No download URL available");

  // Validate the URL is accessible
  console.log(`Validating download URL: ${downloadUrl}`);
  const headRes = await fetch(downloadUrl, { method: "HEAD" });
  console.log(`HEAD response: ${headRes.status} ${headRes.statusText}`);

  if (!headRes.ok) {
    console.log("Download URL is not accessible — triggering fresh Descript export first");
    // Reset to approved so the pipeline can re-export
    await db.update(videoJobs).set({ 
      status: "approved",
      descriptDownloadUrl: null,
      s3VideoUrl: null,
    }).where(eq(videoJobs.id, 30002));
    console.log("Reset download URLs — approveVideoJob procedure will handle re-export");
    return;
  }

  // Set to uploading and start upload
  await db.update(videoJobs).set({ status: "uploading" }).where(eq(videoJobs.id, 30002));
  console.log("✅ Status set to uploading — starting YouTube upload...");

  try {
    const result = await uploadToYouTube({
      jobId: 30002,
      title: job.youtubeTitle ?? "100-Day Goal Setting: Ancient Wisdom to Master Your Life",
      description: job.youtubeDescription ?? "",
      tags: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
      videoUrl: downloadUrl,
    });

    await db.update(videoJobs).set({
      status: "uploaded_unlisted",
      youtubeVideoId: result.videoId,
    }).where(eq(videoJobs.id, 30002));

    console.log(`✅ Uploaded to YouTube! Video ID: ${result.videoId}`);
    console.log(`   Watch URL: https://www.youtube.com/watch?v=${result.videoId}`);
    console.log(`   Studio URL: https://studio.youtube.com/video/${result.videoId}/edit`);
  } catch (err) {
    await db.update(videoJobs).set({ 
      status: "failed", 
      errorMessage: err instanceof Error ? err.message : String(err) 
    }).where(eq(videoJobs.id, 30002));
    throw err;
  }
}

main().catch(console.error);
