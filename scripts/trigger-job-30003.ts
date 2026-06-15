import { getDb } from "../server/db.ts";
import { videoJobs } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { processScheduledVideoJobs } from "../server/descriptPipeline.ts";

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const [job] = await db.select().from(videoJobs).where(eq(videoJobs.id, 30003));
  console.log("Job 30003 current state:", {
    id: job.id,
    status: job.status,
    videoType: job.videoType,
    heygenVideoId: job.heygenVideoId,
    descriptProjectId: job.descriptProjectId,
    youtubeTitle: job.youtubeTitle?.substring(0, 70),
    updatedAt: job.updatedAt,
    errorMessage: job.errorMessage,
  });

  console.log("\nTriggering pipeline cron...");
  await processScheduledVideoJobs();
  console.log("Cron complete.");

  const [jobAfter] = await db.select().from(videoJobs).where(eq(videoJobs.id, 30003));
  console.log("\nJob 30003 after cron:", {
    status: jobAfter.status,
    heygenVideoId: jobAfter.heygenVideoId,
    descriptProjectId: jobAfter.descriptProjectId,
    errorMessage: jobAfter.errorMessage,
  });

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
