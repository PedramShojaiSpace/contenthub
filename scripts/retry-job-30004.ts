import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processVideoJob } from "../server/descriptPipeline";

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  console.log("Resetting job #30004 to pending...");
  await db.update(videoJobs).set({
    status: "pending",
    errorMessage: null,
    heygenVideoId: null,
    descriptProjectId: null,
    descriptImportJobId: null,
    descriptAgentJobId: null,
    descriptPublishJobId: null,
    descriptShareUrl: null,
    descriptDownloadUrl: null,
    s3VideoUrl: null,
    youtubeVideoId: null,
    vaApprovedAt: null,
  }).where(eq(videoJobs.id, 30004));

  console.log("Job #30004 reset to pending. Triggering processVideoJob...");
  await processVideoJob(30004);
  console.log("Done. Check the job status — HeyGen render should now be queued.");

  const [job] = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    heygenVideoId: videoJobs.heygenVideoId,
    errorMessage: videoJobs.errorMessage,
  }).from(videoJobs).where(eq(videoJobs.id, 30004));

  console.log("Job #30004 after retry:", JSON.stringify(job, null, 2));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
