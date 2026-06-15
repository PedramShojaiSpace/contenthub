import "dotenv/config";
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processVideoJob } from "../server/descriptPipeline";
import { ENV } from "../server/_core/env";

async function getQuota(): Promise<{ remaining: number; plan: number }> {
  const res = await fetch("https://api.heygen.com/v2/user/remaining_quota", {
    headers: { "X-Api-Key": ENV.heygenApiKey },
  });
  const json = await res.json() as any;
  return {
    remaining: json.data?.remaining_quota ?? -1,
    plan: json.data?.details?.plan_credit ?? -1,
  };
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // Check quota before
  const before = await getQuota();
  console.log(`=== HeyGen Quota BEFORE: remaining=${before.remaining} plan_credits=${before.plan} ===`);

  if (before.remaining === 0) {
    console.error("❌ Still 0 remaining quota — credits not yet restored. Aborting.");
    process.exit(1);
  }

  // Reset job 30004
  console.log("\nResetting job #30004 to pending...");
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

  console.log("Triggering processVideoJob for #30004...");
  await processVideoJob(30004);

  // Check result
  const [job] = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    heygenVideoId: videoJobs.heygenVideoId,
    errorMessage: videoJobs.errorMessage,
  }).from(videoJobs).where(eq(videoJobs.id, 30004));

  console.log("\nJob #30004 result:", JSON.stringify(job, null, 2));

  // Check quota after
  const after = await getQuota();
  console.log(`\n=== HeyGen Quota AFTER: remaining=${after.remaining} plan_credits=${after.plan} ===`);
  const used = before.remaining - after.remaining;
  console.log(`Credits used for this render: ${used >= 0 ? used : "unknown (quota increased)"}`);

  if (job.status === "rendering" && job.heygenVideoId) {
    console.log(`\n✅ HeyGen render started successfully!`);
    console.log(`   video_id: ${job.heygenVideoId}`);
    console.log(`   The cron will poll every 15 min and advance to Descript when done.`);
  } else {
    console.log(`\n❌ Job did not reach rendering status. Error: ${job.errorMessage}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
