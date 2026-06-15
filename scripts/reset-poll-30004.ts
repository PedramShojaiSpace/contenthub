import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processScheduledVideoJobs } from "../server/descriptPipeline";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Could not connect to database");

  // Reset job 30004 from failed back to rendering so the cron picks it up with fixed polling
  await db.update(videoJobs).set({
    status: "rendering",
    errorMessage: null,
    heygenVideoId: "98914c28c45949f09ca9f0a52196b629",
  }).where(eq(videoJobs.id, 30004));

  console.log("✅ Job 30004 reset to rendering (heygenVideoId=98914c28c45949f09ca9f0a52196b629)");
  console.log("Running pipeline cron with fixed list-fallback polling...");

  await processScheduledVideoJobs();
  console.log("Cron run complete");

  // Check final status
  const rows = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    heygenVideoId: videoJobs.heygenVideoId,
    descriptProjectId: videoJobs.descriptProjectId,
    errorMessage: videoJobs.errorMessage,
  }).from(videoJobs).where(eq(videoJobs.id, 30004));

  console.log("Final job status:", JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
