import "dotenv/config";
import { db } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processScheduledVideoJobs } from "../server/descriptPipeline";

async function main() {
  // Reset job 30004 from failed back to rendering so the cron picks it up with the fixed polling
  await db.update(videoJobs).set({
    status: "rendering",
    errorMessage: null,
    heygenVideoId: "98914c28c45949f09ca9f0a52196b629",
  }).where(eq(videoJobs.id, 30004));

  console.log("✅ Job 30004 reset to rendering (heygenVideoId=98914c28c45949f09ca9f0a52196b629)");
  console.log("Running pipeline cron to poll HeyGen status with fixed list-fallback...");

  await processScheduledVideoJobs();
  console.log("Cron run complete");

  // Check final status
  const [job] = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    heygenVideoId: videoJobs.heygenVideoId,
    errorMessage: videoJobs.errorMessage,
  }).from(videoJobs).where(eq(videoJobs.id, 30004));

  console.log("Final job status:", JSON.stringify(job, null, 2));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
