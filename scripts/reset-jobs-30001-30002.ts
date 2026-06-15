import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

async function reset() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // First show current state
  const jobs = await db.select({
    id: videoJobs.id,
    status: videoJobs.status,
    descriptProjectId: videoJobs.descriptProjectId,
  }).from(videoJobs).where(inArray(videoJobs.id, [30001, 30002]));

  console.log("Current state:");
  for (const j of jobs) {
    console.log(`  Job #${j.id}: status=${j.status}, descriptProjectId=${j.descriptProjectId}`);
  }

  // Reset to pending and clear Descript state so they start fresh
  await db.update(videoJobs)
    .set({
      status: "pending",
      descriptProjectId: null,
      descriptDownloadUrl: null,
      s3VideoUrl: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(inArray(videoJobs.id, [30001, 30002]));

  console.log("\n✅ Reset jobs 30001 and 30002 to pending. They will be picked up by the Descript cron on the next run.");
  process.exit(0);
}

reset().catch(e => { console.error(e); process.exit(1); });
