import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../server/_core/env";

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // Get job 30004
  const [job] = await db.select().from(videoJobs).where(eq(videoJobs.id, 30004));
  if (!job) { console.log("Job #30004 not found"); process.exit(1); }

  console.log("=== Job #30004 ===");
  console.log(`status: ${job.status}`);
  console.log(`videoType: ${job.videoType}`);
  console.log(`heygenVideoId: ${job.heygenVideoId ?? "none"}`);
  console.log(`descriptProjectId: ${job.descriptProjectId ?? "none"}`);
  console.log(`errorMessage: ${job.errorMessage ?? "none"}`);
  console.log(`youtubeTitle: ${job.youtubeTitle}`);
  console.log(`scriptText length: ${job.scriptText?.length ?? 0} chars`);
  console.log(`contentItemId: ${job.contentItemId}`);
  console.log(`createdAt: ${job.createdAt}`);
  console.log(`updatedAt: ${job.updatedAt}`);

  // If it has a heygenVideoId, check its status
  if (job.heygenVideoId) {
    console.log("\n=== HeyGen Status Poll ===");
    const res = await fetch(`https://api.heygen.com/v1/video.status.get?video_id=${job.heygenVideoId}`, {
      headers: { "X-Api-Key": ENV.heygenApiKey },
    });
    const json = await res.json() as any;
    console.log(`HTTP ${res.status}:`, JSON.stringify(json, null, 2));
  } else {
    console.log("\n⚠️  No heygenVideoId — HeyGen was never called for this job.");
    console.log("Checking server logs for the error...");
  }

  // Also check job 30003 for comparison
  const [job3] = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    videoType: videoJobs.videoType,
    heygenVideoId: videoJobs.heygenVideoId,
    descriptProjectId: videoJobs.descriptProjectId,
    errorMessage: videoJobs.errorMessage,
    updatedAt: videoJobs.updatedAt,
  }).from(videoJobs).where(eq(videoJobs.id, 30003));

  console.log("\n=== Job #30003 (for comparison) ===");
  console.log(JSON.stringify(job3, null, 2));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
