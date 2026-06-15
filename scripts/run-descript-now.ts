/**
 * Manually trigger the Descript pipeline for jobs 30001 and 30002
 * and show real-time progress.
 */
import { processVideoJob } from "../server/descriptPipeline";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const jobs = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    youtubeTitle: videoJobs.youtubeTitle,
    videoType: videoJobs.videoType,
  }).from(videoJobs).where(inArray(videoJobs.id, [30001, 30002]));

  console.log("Jobs before run:");
  for (const j of jobs) {
    console.log(`  #${j.id}: status=${j.status} type=${j.videoType ?? "standard"} title=${j.youtubeTitle}`);
  }

  // Filter out avatar jobs (handled by heygenRouter)
  const standardJobs = jobs.filter(j => j.videoType !== "avatar");
  
  for (const job of standardJobs) {
    console.log(`\n▶ Processing job #${job.id}...`);
    try {
      await processVideoJob(job.id);
      
      // Re-read status after processing
      const [updated] = await db.select({ status: videoJobs.status, errorMessage: videoJobs.errorMessage })
        .from(videoJobs).where(inArray(videoJobs.id, [job.id]));
      console.log(`  ✅ Job #${job.id} processed → status: ${updated.status}`);
      if (updated.errorMessage) console.log(`  ⚠️  Error: ${updated.errorMessage}`);
    } catch (err) {
      console.log(`  ❌ Job #${job.id} failed: ${err}`);
    }
  }

  console.log("\nDone. Jobs are now in the pipeline — the cron will continue polling them.");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
