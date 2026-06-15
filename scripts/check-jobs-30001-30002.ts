import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { inArray } from "drizzle-orm";
import { ENV } from "../server/_core/env";

async function check() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const jobs = await db.select().from(videoJobs).where(inArray(videoJobs.id, [30001, 30002]));

  for (const job of jobs) {
    console.log(`\n=== Job #${job.id} ===`);
    console.log(`  Title:           ${job.youtubeTitle}`);
    console.log(`  Status:          ${job.status}`);
    console.log(`  VideoType:       ${job.videoType ?? "standard"}`);
    console.log(`  HeyGen Job ID:   ${job.heygenVideoId ?? "(none)"}`);
    console.log(`  Descript Proj:   ${job.descriptProjectId ?? "(none)"}`);
    console.log(`  Descript DL URL: ${job.descriptDownloadUrl ? job.descriptDownloadUrl.slice(0, 80) + "..." : "(none)"}`);
    console.log(`  S3 Video URL:    ${job.s3VideoUrl ? job.s3VideoUrl.slice(0, 80) + "..." : "(none)"}`);
    console.log(`  Error:           ${job.errorMessage ?? "(none)"}`);
    console.log(`  Updated:         ${job.updatedAt}`);
  }

  // Check HeyGen status for any rendering jobs
  for (const job of jobs) {
    if (job.heygenVideoId && job.status === "rendering") {
      console.log(`\n--- HeyGen API check for Job #${job.id} (${job.heygenVideoId}) ---`);
      try {
        const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${job.heygenVideoId}`, {
          headers: { "X-Api-Key": ENV.HEYGEN_API_KEY },
        });
        const data = await res.json() as any;
        console.log(`  HeyGen status: ${data.data?.status ?? JSON.stringify(data)}`);
        if (data.data?.video_url) console.log(`  HeyGen video URL: ${data.data.video_url}`);
        if (data.data?.error) console.log(`  HeyGen error: ${JSON.stringify(data.data.error)}`);
      } catch (e) {
        console.log(`  HeyGen check failed: ${e}`);
      }
    }
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
