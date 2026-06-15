/**
 * Fix stuck syndication jobs that are permanently in 'adapting' status.
 * Root cause: the cron sets status='adapting' before the AI call, but if the
 * server restarts mid-run, the job stays stuck because the cron only picks up 'pending' jobs.
 */
import { getDb } from "../server/db";
import { syndicationJobs } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

async function fixStuckJobs() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  // Show current state
  const allJobs = await db.select({
    id: syndicationJobs.id,
    platform: syndicationJobs.platform,
    status: syndicationJobs.status,
    wordpressTitle: syndicationJobs.wordpressTitle,
    errorMessage: syndicationJobs.errorMessage,
    updatedAt: syndicationJobs.updatedAt,
  }).from(syndicationJobs).orderBy(syndicationJobs.id);

  console.log(`\nAll syndication jobs (${allJobs.length} total):`);
  for (const j of allJobs) {
    const stuck = j.status === "adapting" ? " ← STUCK" : "";
    console.log(`  [${j.id}] ${j.platform.padEnd(10)} ${j.status.padEnd(12)} "${(j.wordpressTitle ?? "").slice(0, 50)}"${stuck}`);
    if (j.errorMessage) console.log(`         Error: ${j.errorMessage.slice(0, 100)}`);
  }

  // Reset stuck adapting jobs
  const stuckJobs = allJobs.filter(j => j.status === "adapting");
  if (stuckJobs.length === 0) {
    console.log("\n✅ No stuck jobs found.");
    process.exit(0);
  }

  console.log(`\n🔧 Resetting ${stuckJobs.length} stuck job(s) to pending...`);
  const stuckIds = stuckJobs.map(j => j.id);

  await db.update(syndicationJobs)
    .set({
      status: "pending",
      scheduledAt: Date.now(), // retry immediately
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(inArray(syndicationJobs.id, stuckIds));

  console.log(`✅ Reset ${stuckJobs.length} job(s) to pending. They will be processed on the next cron run.`);
  console.log("\nStuck jobs that were reset:");
  for (const j of stuckJobs) {
    console.log(`  [${j.id}] ${j.platform} - "${(j.wordpressTitle ?? "").slice(0, 60)}"`);
  }

  process.exit(0);
}

fixStuckJobs().catch(e => { console.error(e); process.exit(1); });
